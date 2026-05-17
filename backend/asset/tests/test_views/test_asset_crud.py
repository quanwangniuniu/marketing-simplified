from django.test import TestCase
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status
from asset.models import Asset
from core.models import Organization, Team, Project
from task.models import Task
import tempfile
import os

User = get_user_model()


class AssetListViewTest(APITestCase):
    """Test cases for AssetListView (GET, POST /assets/)"""
    
    def setUp(self):
        # Create test user
        self.user = User.objects.create_user(
            email='test@example.com',
            username='testuser',
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
        
        # Create project and task
        self.project = Project.objects.create(name="Test Project", organization=self.organization)
        self.task = Task.objects.create(summary="Test Task", type="asset", project=self.project)
        
        # Create test assets
        self.asset1 = Asset.objects.create(
            task=self.task,
            owner=self.user,
            team=self.team,
            status=Asset.NOT_SUBMITTED,
            tags=['test', 'asset1']
        )
        
        self.asset2 = Asset.objects.create(
            task=self.task,
            owner=self.user,
            team=self.team,
            status=Asset.PENDING_REVIEW,
            tags=['test', 'asset2']
        )
        
        # URL for asset list
        self.url = reverse('asset:asset-list')  # Using namespaced URL
    
    def test_list_assets_authenticated_user(self):
        """Test that authenticated user can list assets"""
        self.client.force_authenticate(user=self.user)
        response = self.client.get(self.url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 2)
        
        # Check that both assets are in the response
        asset_ids = [asset['id'] for asset in response.data['results']]
        self.assertIn(self.asset1.id, asset_ids)
        self.assertIn(self.asset2.id, asset_ids)
    
    def test_list_assets_unauthenticated_user(self):
        """Test that unauthenticated user gets 401 when trying to list assets"""
        response = self.client.get(self.url)
        
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
    
    def test_create_asset_valid_data(self):
        """Test creating asset with valid data - owner auto-set, status defaults to Draft"""
        self.client.force_authenticate(user=self.user)
        
        data = {
            'task': self.task.id,
            'team': self.team.id,
            'tags': ['new', 'asset']
        }
        
        response = self.client.post(self.url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        # Check that asset was created with correct data
        asset = Asset.objects.get(id=response.data['id'])
        self.assertEqual(asset.owner, self.user)  # Must be auto-set to current user
        self.assertEqual(asset.status, Asset.NOT_SUBMITTED)  # Must default to NotSubmitted
        self.assertEqual(asset.task, self.task)
        self.assertEqual(asset.team, self.team)
        self.assertEqual(asset.tags, ['new', 'asset'])
    
    def test_create_asset_with_invalid_owner_ignored(self):
        """Test that providing owner in request is ignored - owner is always set to current user"""
        self.client.force_authenticate(user=self.user)
        
        data = {
            'task': self.task.id,
            'team': self.team.id,
            'owner': 999,  # Invalid owner ID
            'tags': ['new', 'asset']
        }
        
        response = self.client.post(self.url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        # Check that asset was created with current user as owner, not the provided owner
        asset = Asset.objects.get(id=response.data['id'])
        self.assertEqual(asset.owner, self.user)  # Must be current user, not 999
        self.assertEqual(asset.status, Asset.NOT_SUBMITTED)  # Must default to NotSubmitted
    
    def test_create_asset_minimal_data(self):
        """Test creating asset with minimal required data"""
        self.client.force_authenticate(user=self.user)
        
        data = {
            'task': self.task.id,
            'team': self.team.id
        }
        
        response = self.client.post(self.url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        # Check that asset was created with defaults
        asset = Asset.objects.get(id=response.data['id'])
        self.assertEqual(asset.owner, self.user)
        self.assertEqual(asset.status, Asset.NOT_SUBMITTED)
        self.assertEqual(asset.tags, [])  # Default empty list
    
    def test_create_asset_invalid_data(self):
        """Test creating asset with invalid data"""
        self.client.force_authenticate(user=self.user)
        
        data = {
            'task': 'invalid_task_id',  # Invalid task ID
            'team': self.team.id
        }
        
        response = self.client.post(self.url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
    
    def test_create_asset_with_nonexistent_task(self):
        """Test creating asset with non-existent task"""
        self.client.force_authenticate(user=self.user)
        
        data = {
            'task': 99999,  # Non-existent task ID
            'team': self.team.id,
            'tags': ['new', 'asset']
        }
        
        response = self.client.post(self.url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
    
    def test_create_asset_with_nonexistent_team(self):
        """Test creating asset with non-existent team"""
        self.client.force_authenticate(user=self.user)
        
        data = {
            'task': self.task.id,
            'team': 99999,  # Non-existent team ID
            'tags': ['new', 'asset']
        }
        
        response = self.client.post(self.url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
    
    def test_create_asset_with_invalid_task_type(self):
        """Test creating asset with invalid task type"""
        self.client.force_authenticate(user=self.user)
        
        data = {
            'task': 'not_an_integer',  # Invalid task type
            'team': self.team.id,
            'tags': ['new', 'asset']
        }
        
        response = self.client.post(self.url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
    
    def test_create_asset_with_invalid_team_type(self):
        """Test creating asset with invalid team type"""
        self.client.force_authenticate(user=self.user)
        
        data = {
            'task': self.task.id,
            'team': 'not_an_integer',  # Invalid team type
            'tags': ['new', 'asset']
        }
        
        response = self.client.post(self.url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
    
    def test_create_asset_read_only_fields_ignored(self):
        """Test that read-only fields are ignored during creation"""
        self.client.force_authenticate(user=self.user)
        
        data = {
            'task': self.task.id,
            'team': self.team.id,
            'id': 999,  # Read-only field
            'status': Asset.APPROVED,  # Read-only field
            'created_at': '2023-01-01T00:00:00Z',  # Read-only field
            'updated_at': '2023-01-01T00:00:00Z',  # Read-only field
            'tags': ['new', 'asset']
        }
        
        response = self.client.post(self.url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        # Check that read-only fields were ignored
        asset = Asset.objects.get(id=response.data['id'])
        self.assertEqual(asset.owner, self.user)  # Must be current user
        self.assertEqual(asset.status, Asset.NOT_SUBMITTED)  # Must be default status
        self.assertNotEqual(asset.id, 999)  # Must not be the provided ID


class AssetDetailViewTest(APITestCase):
    """Test cases for AssetDetailView (GET, PUT, DELETE /assets/{id}/)"""
    
    def setUp(self):
        # Create test user
        self.user = User.objects.create_user(
            email='test@example.com',
            username='testuser',
            password='testpass123'
        )
        
        # Create another user for testing
        self.other_user = User.objects.create_user(
            email='other@example.com',
            username='otheruser',
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
        
        # Create project and task
        self.project = Project.objects.create(name="Test Project", organization=self.organization)
        self.task = Task.objects.create(summary="Test Task", type="asset", project=self.project)
        
        # Create test asset
        self.asset = Asset.objects.create(
            task=self.task,
            owner=self.user,
            team=self.team,
            status=Asset.NOT_SUBMITTED,
            tags=['test']
        )
    
    def test_get_asset_detail(self):
        """Test getting asset detail"""
        self.client.force_authenticate(user=self.user)
        url = reverse('asset:asset-detail', kwargs={'pk': self.asset.pk})
        
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['id'], self.asset.id)
        self.assertEqual(response.data['task'], self.task.id)
        self.assertEqual(response.data['owner'], self.user.get_full_name().strip() or self.user.username or self.user.email)
        self.assertEqual(response.data['status'], Asset.NOT_SUBMITTED)
    
    def test_get_asset_detail_unauthenticated(self):
        """Test that unauthenticated user gets 401 when trying to get asset detail"""
        url = reverse('asset:asset-detail', kwargs={'pk': self.asset.pk})
        
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
    
    def test_get_nonexistent_asset(self):
        """Test getting non-existent asset returns 404"""
        self.client.force_authenticate(user=self.user)
        url = reverse('asset:asset-detail', kwargs={'pk': 99999})
        
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
    
    def test_update_asset_valid_data(self):
        """Test updating asset with valid data"""
        self.client.force_authenticate(user=self.user)
        url = reverse('asset:asset-detail', kwargs={'pk': self.asset.pk})
        
        data = {
            'task': self.task.id,
            'team': self.team.id,
            'tags': ['updated', 'tags']
        }
        
        response = self.client.put(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Check that asset was updated
        self.asset.refresh_from_db()
        self.assertEqual(self.asset.tags, ['updated', 'tags'])
        self.assertEqual(self.asset.task, self.task)
        self.assertEqual(self.asset.team, self.team)
    
    def test_update_asset_invalid_data(self):
        """Test updating asset with invalid data"""
        self.client.force_authenticate(user=self.user)
        url = reverse('asset:asset-detail', kwargs={'pk': self.asset.pk})
        
        data = {
            'task': 'invalid_task_id',  # Invalid task ID
            'team': self.team.id,
            'tags': ['updated', 'tags']
        }
        
        response = self.client.put(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
    
    def test_update_asset_read_only_fields_ignored(self):
        """Test that read-only fields are ignored during update"""
        self.client.force_authenticate(user=self.user)
        url = reverse('asset:asset-detail', kwargs={'pk': self.asset.pk})
        
        original_owner = self.asset.owner
        original_status = self.asset.status
        original_created_at = self.asset.created_at
        
        data = {
            'task': self.task.id,
            'team': self.team.id,
            'owner': self.other_user.id,  # Read-only field
            'status': Asset.APPROVED,  # Read-only field
            'created_at': '2023-01-01T00:00:00Z',  # Read-only field
            'tags': ['updated', 'tags']
        }
        
        response = self.client.put(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Check that read-only fields were ignored
        self.asset.refresh_from_db()
        self.assertEqual(self.asset.owner, original_owner)  # Must not change
        self.assertEqual(self.asset.status, original_status)  # Must not change
        self.assertEqual(self.asset.created_at, original_created_at)  # Must not change
        self.assertEqual(self.asset.tags, ['updated', 'tags'])  # Must change
    
    def test_delete_asset(self):
        """Test deleting asset"""
        self.client.force_authenticate(user=self.user)
        url = reverse('asset:asset-detail', kwargs={'pk': self.asset.pk})
        
        response = self.client.delete(url)
        
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        
        # Check that asset was deleted
        self.assertFalse(Asset.objects.filter(id=self.asset.id).exists())
    
    def test_delete_nonexistent_asset(self):
        """Test deleting non-existent asset returns 404"""
        self.client.force_authenticate(user=self.user)
        url = reverse('asset:asset-detail', kwargs={'pk': 99999})
        
        response = self.client.delete(url)
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
    
    def test_delete_asset_unauthenticated(self):
        """Test that unauthenticated user gets 401 when trying to delete asset"""
        url = reverse('asset:asset-detail', kwargs={'pk': self.asset.pk})
        
        response = self.client.delete(url)
        
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
    
    def test_delete_asset_twice(self):
        """Test deleting the same asset twice"""
        self.client.force_authenticate(user=self.user)
        url = reverse('asset:asset-detail', kwargs={'pk': self.asset.pk})
        
        # First delete
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        
        # Second delete
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
    
    def test_delete_asset_with_different_user(self):
        """Test that different user can delete asset (no ownership restriction)"""
        self.client.force_authenticate(user=self.other_user)
        url = reverse('asset:asset-detail', kwargs={'pk': self.asset.pk})
        
        response = self.client.delete(url)
        
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        
        # Check that asset was deleted
        self.assertFalse(Asset.objects.filter(id=self.asset.id).exists())
    
    def test_http_methods_not_allowed(self):
        """Test that unsupported HTTP methods return 405"""
        self.client.force_authenticate(user=self.user)
        url = reverse('asset:asset-detail', kwargs={'pk': self.asset.pk})
        
        # Test PATCH method (not allowed)
        response = self.client.patch(url, {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
        
        # Test POST method (not allowed)
        response = self.client.post(url, {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)


class AssetListViewWithFileTest(APITestCase):
    """Test cases for AssetListView with file handling"""
    
    def setUp(self):
        # Create test user
        self.user = User.objects.create_user(
            email='test@example.com',
            username='testuser',
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
        
        # Create project and task
        self.project = Project.objects.create(name="Test Project", organization=self.organization)
        self.task = Task.objects.create(summary="Test Task", type="asset", project=self.project)
        
        # Create a temporary test file
        self.test_file = tempfile.NamedTemporaryFile(delete=False, suffix='.txt')
        self.test_file.write(b'test file content')
        self.test_file.close()
        
        # URL for asset list
        self.url = reverse('asset:asset-list')
    
    def tearDown(self):
        # Clean up temporary file
        if hasattr(self, 'test_file'):
            os.unlink(self.test_file.name)
    
    def test_create_asset_with_file_upload(self):
        """Test creating asset with file upload (though assets don't directly handle files)"""
        self.client.force_authenticate(user=self.user)
        
        data = {
            'task': self.task.id,
            'team': self.team.id,
            'tags': ['file', 'test']
        }
        
        response = self.client.post(self.url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        # Check that asset was created
        asset = Asset.objects.get(id=response.data['id'])
        self.assertEqual(asset.owner, self.user)
        self.assertEqual(asset.status, Asset.NOT_SUBMITTED)
        self.assertEqual(asset.tags, ['file', 'test'])
    
    def test_create_asset_with_large_tags(self):
        """Test creating asset with large number of tags"""
        self.client.force_authenticate(user=self.user)
        
        large_tags = [f'tag_{i}' for i in range(100)]
        
        data = {
            'task': self.task.id,
            'team': self.team.id,
            'tags': large_tags
        }
        
        response = self.client.post(self.url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        # Check that asset was created with all tags
        asset = Asset.objects.get(id=response.data['id'])
        self.assertEqual(asset.tags, large_tags)
    
    def test_create_asset_with_empty_tags(self):
        """Test creating asset with empty tags list"""
        self.client.force_authenticate(user=self.user)
        
        data = {
            'task': self.task.id,
            'team': self.team.id,
            'tags': []
        }
        
        response = self.client.post(self.url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        # Check that asset was created with empty tags
        asset = Asset.objects.get(id=response.data['id'])
        self.assertEqual(asset.tags, [])
    
    def test_create_asset_without_tags(self):
        """Test creating asset without tags field"""
        self.client.force_authenticate(user=self.user)
        
        data = {
            'task': self.task.id,
            'team': self.team.id
        }
        
        response = self.client.post(self.url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        # Check that asset was created with default empty tags
        asset = Asset.objects.get(id=response.data['id'])
        self.assertEqual(asset.tags, [])
    
    def test_create_asset_with_duplicate_tags(self):
        """Test creating asset with duplicate tags"""
        self.client.force_authenticate(user=self.user)
        
        data = {
            'task': self.task.id,
            'team': self.team.id,
            'tags': ['tag1', 'tag1', 'tag2', 'tag2', 'tag1']
        }
        
        response = self.client.post(self.url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        # Check that asset was created with duplicate tags preserved
        asset = Asset.objects.get(id=response.data['id'])
        self.assertEqual(asset.tags, ['tag1', 'tag1', 'tag2', 'tag2', 'tag1'])
    
    def test_create_asset_with_special_characters_in_tags(self):
        """Test creating asset with special characters in tags"""
        self.client.force_authenticate(user=self.user)
        
        data = {
            'task': self.task.id,
            'team': self.team.id,
            'tags': ['tag with spaces', 'tag-with-dashes', 'tag_with_underscores', 'tag@#$%^&*()']
        }
        
        response = self.client.post(self.url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        # Check that asset was created with special character tags
        asset = Asset.objects.get(id=response.data['id'])
        self.assertEqual(asset.tags, ['tag with spaces', 'tag-with-dashes', 'tag_with_underscores', 'tag@#$%^&*()']) 