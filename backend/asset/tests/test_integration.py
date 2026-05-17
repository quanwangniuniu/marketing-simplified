"""
Integration tests for asset creation and version management workflow.
These tests focus on end-to-end workflows that simulate real user scenarios.
"""

import os
import tempfile
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APITestCase
from rest_framework import status
from django.urls import reverse

from asset.models import Asset, AssetVersion
from core.models import Organization, Team, Project
from task.models import Task

User = get_user_model()


class BaseIntegrationTestCase(APITestCase):
    """Base test case for integration testing with common setup"""
    
    def setUp(self):
        """Set up common test data"""
        # Create test users
        self.owner = User.objects.create_user(
            email='owner@example.com',
            username='owner',
            password='testpass123'
        )
        self.reviewer = User.objects.create_user(
            email='reviewer@example.com',
            username='reviewer',
            password='testpass123'
        )
        self.approver = User.objects.create_user(
            email='approver@example.com',
            username='approver',
            password='testpass123'
        )
        
        # Create test organization and team
        self.organization = Organization.objects.create(
            name="Test Organization"
        )
        self.team = Team.objects.create(
            organization=self.organization,
            name="Test Team"
        )

        # Create project and task (core models)
        self.project = Project.objects.create(name="Integration Test Project", organization=self.organization)
        self.task = Task.objects.create(summary="Integration Test Task", type="asset", project=self.project)
        
        # Authenticate as owner by default
        self.client.force_authenticate(user=self.owner)
    
    def create_test_file(self, filename='test_file.txt', content='Test content for integration testing'):
        """Helper method to create a test file"""
        return SimpleUploadedFile(
            filename,
            content.encode('utf-8'),
            content_type='text/plain'
        )
    
    def create_asset(self, **kwargs):
        """Helper method to create an asset"""
        data = {
            'task': self.task.id,
            'team': self.team.id,
            'tags': ['integration', 'test'],
            **kwargs
        }
        response = self.client.post(reverse('asset:asset-list'), data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        return response.data
    
    def upload_version(self, asset_id, file_obj=None, **kwargs):
        """Helper method to upload a version"""
        if file_obj is None:
            file_obj = self.create_test_file()
        
        data = {
            'file': file_obj,
            **kwargs
        }
        response = self.client.post(
            reverse('asset:asset-version-list', kwargs={'asset_id': asset_id}),
            data,
            format='multipart'
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        return response.data
    
    def publish_version(self, asset_id, version_id):
        """Helper method to publish a version"""
        # First, we need to simulate virus scanning to mark the version as clean
        # In a real scenario, this would be done by the Celery task
        version = AssetVersion.objects.get(id=version_id, asset_id=asset_id)
        if version.scan_status == AssetVersion.PENDING:
            # Simulate virus scanning by directly updating scan status
            version.scan_status = AssetVersion.CLEAN
            version.save(update_fields=['scan_status'])
        
        response = self.client.post(
            reverse('asset:asset-version-publish', kwargs={
                'asset_id': asset_id,
                'version_id': version_id
            })
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        return response.data
    
    def submit_asset(self, asset_id):
        """Helper method to submit an asset for review"""
        response = self.client.put(
            reverse('asset:asset-submit', kwargs={'pk': asset_id})
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        return response.data


class AssetCreationAndVersionManagementIntegrationTest(BaseIntegrationTestCase):
    """Integration tests for asset creation and version management workflow"""
    
    def test_complete_asset_creation_workflow(self):
        """Test the complete asset creation workflow from start to finish"""
        
        # Step 1: Create an asset
        print("Step 1: Creating asset...")
        asset_data = self.create_asset()
        asset_id = asset_data['id']
        
        # Verify asset was created correctly
        self.assertEqual(asset_data['status'], Asset.NOT_SUBMITTED)
        self.assertEqual(asset_data['owner'], self.owner.get_full_name().strip() or self.owner.username or self.owner.email)
        self.assertEqual(asset_data['task'], self.task.id)
        self.assertEqual(asset_data['team'], self.team.id)
        self.assertEqual(asset_data['tags'], ['integration', 'test'])
        
        # Step 2: Upload first version
        print("Step 2: Uploading first version...")
        version_data = self.upload_version(asset_id)
        version_id = version_data['id']
        
        # Verify version was created correctly
        self.assertEqual(version_data['version_number'], 1)
        self.assertEqual(version_data['version_status'], AssetVersion.DRAFT)
        self.assertEqual(version_data['scan_status'], AssetVersion.PENDING)
        self.assertIsNotNone(version_data['file'])
        
        # Step 3: Publish the version
        print("Step 3: Publishing version...")
        published_data = self.publish_version(asset_id, version_id)
        
        # Verify version was published
        self.assertEqual(published_data['version_status'], AssetVersion.FINALIZED)
        
        # Step 4: Submit asset for review
        print("Step 4: Submitting asset for review...")
        submitted_data = self.submit_asset(asset_id)
        
        # Verify asset was submitted
        self.assertEqual(submitted_data['status'], Asset.PENDING_REVIEW)
        
        # Step 5: Verify the complete workflow
        print("Step 5: Verifying complete workflow...")
        
        # Check asset details
        response = self.client.get(reverse('asset:asset-detail', kwargs={'pk': asset_id}))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        asset = response.data
        self.assertEqual(asset['status'], Asset.PENDING_REVIEW)
        
        # Check version details
        response = self.client.get(reverse('asset:asset-version-detail', kwargs={
            'asset_id': asset_id,
            'version_id': version_id
        }))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        version = response.data
        self.assertEqual(version['version_status'], AssetVersion.FINALIZED)
        
        # Check asset history
        response = self.client.get(reverse('asset:asset-history', kwargs={'asset_id': asset_id}))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        history = response.data
        self.assertGreater(len(history), 0)
        
        print("✅ Complete asset creation workflow test passed!")
    
    def test_multiple_versions_workflow(self):
        """Test creating multiple versions of an asset"""
        
        # Step 1: Create an asset
        asset_data = self.create_asset()
        asset_id = asset_data['id']
        
        # Step 2: Upload first version and publish it
        version1_data = self.upload_version(asset_id, file_obj=self.create_test_file('v1.txt', 'Version 1 content'))
        version1_id = version1_data['id']
        self.publish_version(asset_id, version1_id)
        
        # Step 3: Upload second version
        version2_data = self.upload_version(asset_id, file_obj=self.create_test_file('v2.txt', 'Version 2 content'))
        version2_id = version2_data['id']
        
        # Verify second version has correct version number
        self.assertEqual(version2_data['version_number'], 2)
        self.assertEqual(version2_data['version_status'], AssetVersion.DRAFT)
        
        # Step 4: Publish second version
        self.publish_version(asset_id, version2_id)
        
        # Step 5: Submit asset for review
        self.submit_asset(asset_id)
        
        # Step 6: Verify all versions
        response = self.client.get(reverse('asset:asset-version-list', kwargs={'asset_id': asset_id}))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        versions = response.data['results']
        
        self.assertEqual(len(versions), 2)
        self.assertEqual(versions[0]['version_number'], 2)  # Latest version first
        self.assertEqual(versions[1]['version_number'], 1)
        self.assertEqual(versions[0]['version_status'], AssetVersion.FINALIZED)
        self.assertEqual(versions[1]['version_status'], AssetVersion.FINALIZED)
        
        print("✅ Multiple versions workflow test passed!")
    
    def test_version_update_workflow(self):
        """Test updating an existing version"""
        
        # Step 1: Create an asset and upload version
        asset_data = self.create_asset()
        asset_id = asset_data['id']
        version_data = self.upload_version(asset_id)
        version_id = version_data['id']
        
        # Step 2: Update the version with a new file
        new_file = self.create_test_file('updated.txt', 'Updated content')
        update_data = {
            'file': new_file
        }
        response = self.client.put(
            reverse('asset:asset-version-detail', kwargs={
                'asset_id': asset_id,
                'version_id': version_id
            }),
            update_data,
            format='multipart'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Step 3: Verify the update
        updated_version = response.data
        self.assertNotEqual(updated_version['file'], version_data['file'])
        
        # Step 4: Publish and submit
        self.publish_version(asset_id, version_id)
        self.submit_asset(asset_id)
        
        print("✅ Version update workflow test passed!")
    
    def test_asset_without_task_workflow(self):
        """Test creating an asset without a task (optional field)"""
        
        # Step 1: Create an asset without task
        data = {
            'team': self.team.id,
            'tags': ['no-task', 'test']
        }
        response = self.client.post(reverse('asset:asset-list'), data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        asset_data = response.data
        asset_id = asset_data['id']
        
        # Verify asset was created without task
        self.assertIsNone(asset_data['task'])
        self.assertEqual(asset_data['status'], Asset.NOT_SUBMITTED)
        
        # Step 2: Complete the workflow
        version_data = self.upload_version(asset_id)
        version_id = version_data['id']
        self.publish_version(asset_id, version_id)
        self.submit_asset(asset_id)
        
        # Step 3: Verify final state
        response = self.client.get(reverse('asset:asset-detail', kwargs={'pk': asset_id}))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        asset = response.data
        self.assertEqual(asset['status'], Asset.PENDING_REVIEW)
        
        print("✅ Asset without task workflow test passed!")
    
    def test_asset_tags_workflow(self):
        """Test asset creation with various tag configurations"""
        
        # Test with different tag configurations
        tag_configs = [
            [],  # Empty tags
            ['single'],  # Single tag
            ['tag1', 'tag2', 'tag3'],  # Multiple tags
            ['tag with spaces'],  # Tag with spaces
            ['tag-with-dashes'],  # Tag with dashes
        ]
        
        for tags in tag_configs:
            # Create asset with specific tags
            data = {
                'task': self.task.id,
                'team': self.team.id,
                'tags': tags
            }
            response = self.client.post(reverse('asset:asset-list'), data)
            self.assertEqual(response.status_code, status.HTTP_201_CREATED)
            
            asset_data = response.data
            asset_id = asset_data['id']
            
            # Verify tags were saved correctly
            self.assertEqual(asset_data['tags'], tags)
            
            # Complete the workflow
            version_data = self.upload_version(asset_id)
            version_id = version_data['id']
            self.publish_version(asset_id, version_id)
            self.submit_asset(asset_id)
            
            # Verify final state
            response = self.client.get(reverse('asset:asset-detail', kwargs={'pk': asset_id}))
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            asset = response.data
            self.assertEqual(asset['status'], Asset.PENDING_REVIEW)
            self.assertEqual(asset['tags'], tags)
        
        print("✅ Asset tags workflow test passed!")
    
    def test_error_handling_in_workflow(self):
        """Test error handling during the workflow"""
        
        # Step 1: Create an asset
        asset_data = self.create_asset()
        asset_id = asset_data['id']
        
        # Step 2: Try to submit without publishing version (should fail)
        response = self.client.put(reverse('asset:asset-submit', kwargs={'pk': asset_id}))
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        
        # Step 3: Upload and publish version
        version_data = self.upload_version(asset_id)
        version_id = version_data['id']
        self.publish_version(asset_id, version_id)
        
        # Step 4: Now submit should work
        response = self.client.put(reverse('asset:asset-submit', kwargs={'pk': asset_id}))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Step 5: Try to submit again (should fail - already submitted)
        response = self.client.put(reverse('asset:asset-submit', kwargs={'pk': asset_id}))
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        
        print("✅ Error handling workflow test passed!")
    
    def test_workflow_with_different_file_types(self):
        """Test workflow with different file types"""
        
        file_configs = [
            ('text.txt', 'Text content', 'text/plain'),
            ('document.pdf', 'PDF content', 'application/pdf'),
            ('image.jpg', 'Image content', 'image/jpeg'),
            ('data.json', '{"key": "value"}', 'application/json'),
        ]
        
        for filename, content, content_type in file_configs:
            # Create asset
            asset_data = self.create_asset()
            asset_id = asset_data['id']
            
            # Create file with specific type
            file_obj = SimpleUploadedFile(
                filename,
                content.encode('utf-8'),
                content_type=content_type
            )
            
            # Upload version
            version_data = self.upload_version(asset_id, file_obj=file_obj)
            version_id = version_data['id']
            
            # Verify file was uploaded correctly (filename might be modified by Django)
            self.assertIsNotNone(version_data['file'])
            
            # Complete workflow
            self.publish_version(asset_id, version_id)
            self.submit_asset(asset_id)
            
            # Verify final state
            response = self.client.get(reverse('asset:asset-detail', kwargs={'pk': asset_id}))
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            asset = response.data
            self.assertEqual(asset['status'], Asset.PENDING_REVIEW)
        
        print("✅ Different file types workflow test passed!")


class AssetVersionManagementIntegrationTest(BaseIntegrationTestCase):
    """Integration tests for advanced version management scenarios"""
    
    def test_version_numbering_sequence(self):
        """Test that version numbers are assigned correctly in sequence"""
        
        # Create asset
        asset_data = self.create_asset()
        asset_id = asset_data['id']
        
        # Upload and publish versions one by one to test version numbering
        versions = []
        for i in range(5):
            file_obj = self.create_test_file(f'v{i+1}.txt', f'Version {i+1} content')
            version_data = self.upload_version(asset_id, file_obj=file_obj)
            versions.append(version_data)
            
            # Verify version number
            self.assertEqual(version_data['version_number'], i + 1)
            
            # Publish this version so we can create the next one
            self.publish_version(asset_id, version_data['id'])
        
        # Verify all versions exist
        response = self.client.get(reverse('asset:asset-version-list', kwargs={'asset_id': asset_id}))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        all_versions = response.data['results']
        
        self.assertEqual(len(all_versions), 5)
        for i, version in enumerate(all_versions):
            self.assertEqual(version['version_number'], 5 - i)  # Latest first
            self.assertEqual(version['version_status'], AssetVersion.FINALIZED)
        
        # Submit the asset
        self.submit_asset(asset_id)
        
        # Verify final state
        response = self.client.get(reverse('asset:asset-detail', kwargs={'pk': asset_id}))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        asset = response.data
        self.assertEqual(asset['status'], Asset.PENDING_REVIEW)
        
        print("✅ Version numbering sequence test passed!")
    
    def test_version_deletion_workflow(self):
        """Test deleting versions and its impact on the workflow"""
        
        # Create asset with multiple versions
        asset_data = self.create_asset()
        asset_id = asset_data['id']
        
        # Upload and publish first version
        version1_data = self.upload_version(asset_id, file_obj=self.create_test_file('v1.txt', 'Version 1'))
        version1_id = version1_data['id']
        self.publish_version(asset_id, version1_id)
        
        # Upload second version
        version2_data = self.upload_version(asset_id, file_obj=self.create_test_file('v2.txt', 'Version 2'))
        version2_id = version2_data['id']
        
        # Delete second version
        response = self.client.delete(reverse('asset:asset-version-detail', kwargs={
            'asset_id': asset_id,
            'version_id': version2_id
        }))
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        
        # Verify only first version remains
        response = self.client.get(reverse('asset:asset-version-list', kwargs={'asset_id': asset_id}))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        versions = response.data['results']
        self.assertEqual(len(versions), 1)
        self.assertEqual(versions[0]['version_number'], 1)
        
        # Submit asset should still work
        self.submit_asset(asset_id)
        
        # Verify final state
        response = self.client.get(reverse('asset:asset-detail', kwargs={'pk': asset_id}))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        asset = response.data
        self.assertEqual(asset['status'], Asset.PENDING_REVIEW)
