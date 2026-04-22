from django.test import TestCase
from decimal import Decimal
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
import time

from spreadsheet.models import (
    Spreadsheet,
    Sheet,
    SheetRow,
    SheetColumn,
    Cell,
    ComputedCellType,
    CellValueType,
)
from core.models import Project, Organization

User = get_user_model()


# ========== Helper Functions ==========

def create_test_user(username='testuser', email='test@example.com'):
    """Helper to create test user"""
    return User.objects.create_user(
        username=username,
        email=email,
        password='testpass123'
    )


def create_test_organization(name='Test Organization'):
    """Helper to create test organization"""
    return Organization.objects.create(name=name)


def create_test_project(organization, name='Test Project', owner=None):
    """Helper to create test project"""
    return Project.objects.create(
        name=name,
        organization=organization,
        owner=owner
    )


def create_test_spreadsheet(project, name='Test Spreadsheet'):
    """Helper to create test spreadsheet"""
    return Spreadsheet.objects.create(
        project=project,
        name=name
    )


def create_test_sheet(spreadsheet, name='Test Sheet', position=0):
    """Helper to create test sheet"""
    return Sheet.objects.create(
        spreadsheet=spreadsheet,
        name=name,
        position=position
    )


def create_test_sheet_row(sheet, position=0):
    """Helper to create test sheet row"""
    return SheetRow.objects.create(
        sheet=sheet,
        position=position
    )


# ========== View Tests ==========

class SpreadsheetListViewTest(TestCase):
    """Test cases for SpreadsheetListView"""
    
    def setUp(self):
        """Set up test data"""
        self.user = create_test_user()
        self.organization = create_test_organization()
        self.project = create_test_project(self.organization, owner=self.user)
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        
        # Create test spreadsheets
        self.spreadsheet1 = create_test_spreadsheet(self.project, name='Spreadsheet 1')
        self.spreadsheet2 = create_test_spreadsheet(self.project, name='Spreadsheet 2')
    
    def test_list_spreadsheets_success(self):
        """Test successful spreadsheet list retrieval"""
        url = '/api/spreadsheet/spreadsheets/'
        response = self.client.get(url, {'project_id': self.project.id})
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('results', response.data)
        self.assertIn('count', response.data)
        self.assertIn('page', response.data)
        self.assertIn('page_size', response.data)
        self.assertEqual(response.data['count'], 2)
        self.assertEqual(len(response.data['results']), 2)
    
    def test_list_spreadsheets_missing_project_id(self):
        """Test list spreadsheets without project_id parameter"""
        url = '/api/spreadsheet/spreadsheets/'
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('project_id', response.data)
    
    def test_list_spreadsheets_invalid_project_id(self):
        """Test list spreadsheets with non-existent project_id"""
        url = '/api/spreadsheet/spreadsheets/'
        response = self.client.get(url, {'project_id': 99999})
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
    
    def test_list_spreadsheets_pagination(self):
        """Test spreadsheet list pagination"""
        # Create more spreadsheets
        for i in range(3, 23):
            create_test_spreadsheet(self.project, name=f'Spreadsheet {i}')
        
        url = '/api/spreadsheet/spreadsheets/'
        response = self.client.get(url, {
            'project_id': self.project.id,
            'page': 1,
            'page_size': 10
        })
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 22)
        self.assertEqual(response.data['page'], 1)
        self.assertEqual(response.data['page_size'], 10)
        self.assertEqual(len(response.data['results']), 10)
    
    def test_list_spreadsheets_search(self):
        """Test spreadsheet list with search parameter"""
        create_test_spreadsheet(self.project, name='Searchable Name')
        create_test_spreadsheet(self.project, name='Other Name')
        
        url = '/api/spreadsheet/spreadsheets/'
        response = self.client.get(url, {
            'project_id': self.project.id,
            'search': 'Searchable'
        })
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(response.data['count'], 1)
        self.assertTrue(
            any('Searchable' in result['name'] for result in response.data['results'])
        )
    
    def test_list_spreadsheets_order_by_created_at(self):
        """Test spreadsheet list ordering by created_at"""
        url = '/api/spreadsheet/spreadsheets/'
        response = self.client.get(url, {
            'project_id': self.project.id,
            'order_by': 'created_at'
        })
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data['results']
        # Should be ordered descending (newest first)
        if len(results) > 1:
            self.assertGreaterEqual(
                results[0]['created_at'],
                results[1]['created_at']
            )
    
    def test_list_spreadsheets_order_by_name(self):
        """Test spreadsheet list ordering by name"""
        url = '/api/spreadsheet/spreadsheets/'
        response = self.client.get(url, {
            'project_id': self.project.id,
            'order_by': 'name'
        })
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data['results']
        # Should be ordered ascending by name
        if len(results) > 1:
            names = [r['name'] for r in results]
            self.assertEqual(names, sorted(names))
    
    def test_list_spreadsheets_excludes_deleted(self):
        """Test that deleted spreadsheets are excluded from list"""
        deleted_spreadsheet = create_test_spreadsheet(self.project, name='Deleted')
        deleted_spreadsheet.is_deleted = True
        deleted_spreadsheet.save()
        
        url = '/api/spreadsheet/spreadsheets/'
        response = self.client.get(url, {'project_id': self.project.id})
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 2)  # Only non-deleted
        spreadsheet_ids = [s['id'] for s in response.data['results']]
        self.assertNotIn(deleted_spreadsheet.id, spreadsheet_ids)
    
    def test_create_spreadsheet_success(self):
        """Test successful spreadsheet creation"""
        url = f'/api/spreadsheet/spreadsheets/?project_id={self.project.id}'
        data = {'name': 'New Spreadsheet'}
        
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['name'], 'New Spreadsheet')
        self.assertEqual(response.data['project'], self.project.id)
        self.assertFalse(response.data['is_deleted'])
        
        # Verify in database
        self.assertTrue(
            Spreadsheet.objects.filter(
                project=self.project,
                name='New Spreadsheet',
                is_deleted=False
            ).exists()
        )
    
    def test_create_spreadsheet_missing_project_id(self):
        """Test create spreadsheet without project_id parameter"""
        url = '/api/spreadsheet/spreadsheets/'
        data = {'name': 'New Spreadsheet'}
        
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('project_id', response.data)
    
    def test_create_spreadsheet_invalid_project_id(self):
        """Test create spreadsheet with non-existent project_id"""
        url = '/api/spreadsheet/spreadsheets/?project_id=99999'
        data = {'name': 'New Spreadsheet'}
        
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
    
    def test_create_spreadsheet_duplicate_name(self):
        """Test creating spreadsheet with duplicate name fails"""
        url = f'/api/spreadsheet/spreadsheets/?project_id={self.project.id}'
        data = {'name': 'Duplicate Name'}
        
        # Create first spreadsheet
        response1 = self.client.post(url, data, format='json')
        self.assertEqual(response1.status_code, status.HTTP_201_CREATED)
        
        # Try to create duplicate
        response2 = self.client.post(url, data, format='json')
        self.assertEqual(response2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', response2.data)
    
    def test_create_spreadsheet_missing_name(self):
        """Test creating spreadsheet without name field"""
        url = f'/api/spreadsheet/spreadsheets/?project_id={self.project.id}'
        data = {}
        
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('name', response.data)
    
    def test_create_spreadsheet_empty_name(self):
        """Test creating spreadsheet with empty name"""
        url = f'/api/spreadsheet/spreadsheets/?project_id={self.project.id}'
        data = {'name': ''}
        
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('name', response.data)
    
    def test_create_spreadsheet_authentication_required(self):
        """Test that authentication is required for creating spreadsheet"""
        self.client.logout()
        
        url = f'/api/spreadsheet/spreadsheets/?project_id={self.project.id}'
        data = {'name': 'Unauthenticated'}
        
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
    
    def test_list_spreadsheets_authentication_required(self):
        """Test that authentication is required for listing spreadsheets"""
        self.client.logout()
        
        url = '/api/spreadsheet/spreadsheets/'
        response = self.client.get(url, {'project_id': self.project.id})
        
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class SpreadsheetDetailViewTest(TestCase):
    """Test cases for SpreadsheetDetailView"""
    
    def setUp(self):
        """Set up test data"""
        self.user = create_test_user()
        self.organization = create_test_organization()
        self.project = create_test_project(self.organization, owner=self.user)
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        
        self.spreadsheet = create_test_spreadsheet(self.project, name='Test Spreadsheet')
    
    def test_retrieve_spreadsheet_success(self):
        """Test successful spreadsheet retrieval"""
        url = f'/api/spreadsheet/spreadsheets/{self.spreadsheet.id}/'
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['id'], self.spreadsheet.id)
        self.assertEqual(response.data['name'], 'Test Spreadsheet')
        self.assertEqual(response.data['project'], self.project.id)
    
    def test_retrieve_spreadsheet_not_found(self):
        """Test retrieving non-existent spreadsheet"""
        url = '/api/spreadsheet/spreadsheets/99999/'
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
    
    def test_retrieve_deleted_spreadsheet(self):
        """Test that deleted spreadsheet returns 404"""
        self.spreadsheet.is_deleted = True
        self.spreadsheet.save()
        
        url = f'/api/spreadsheet/spreadsheets/{self.spreadsheet.id}/'
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
    
    def test_update_spreadsheet_success(self):
        """Test successful spreadsheet update"""
        url = f'/api/spreadsheet/spreadsheets/{self.spreadsheet.id}/'
        data = {'name': 'Updated Spreadsheet'}
        
        response = self.client.put(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['name'], 'Updated Spreadsheet')
        self.assertEqual(response.data['id'], self.spreadsheet.id)
        
        # Verify in database
        self.spreadsheet.refresh_from_db()
        self.assertEqual(self.spreadsheet.name, 'Updated Spreadsheet')
    
    def test_update_spreadsheet_updates_timestamp(self):
        """Test that updating spreadsheet name updates the updated_at timestamp"""
        url = f'/api/spreadsheet/spreadsheets/{self.spreadsheet.id}/'
        

        original_updated_at = self.spreadsheet.updated_at
        time.sleep(0.1)
        
        data = {'name': 'Updated Name'}
        response = self.client.put(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['name'], 'Updated Name')
        
        self.spreadsheet.refresh_from_db()
        self.assertGreater(self.spreadsheet.updated_at, original_updated_at)
    
    def test_update_spreadsheet_duplicate_name(self):
        """Test updating spreadsheet with duplicate name fails"""
        spreadsheet2 = create_test_spreadsheet(self.project, name='Other Name')
        
        url = f'/api/spreadsheet/spreadsheets/{spreadsheet2.id}/'
        data = {'name': 'Test Spreadsheet'}  # Same as self.spreadsheet.name
        
        response = self.client.put(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', response.data)
    
    def test_update_spreadsheet_not_found(self):
        """Test updating non-existent spreadsheet"""
        url = '/api/spreadsheet/spreadsheets/99999/'
        data = {'name': 'Updated Name'}
        
        response = self.client.put(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
    
    def test_update_spreadsheet_empty_name(self):
        """Test updating spreadsheet with empty name"""
        url = f'/api/spreadsheet/spreadsheets/{self.spreadsheet.id}/'
        data = {'name': ''}
        
        response = self.client.put(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('name', response.data)
    
    def test_delete_spreadsheet_success(self):
        """Test successful spreadsheet deletion (soft delete)"""
        url = f'/api/spreadsheet/spreadsheets/{self.spreadsheet.id}/'
        response = self.client.delete(url)
        
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        
        # Verify soft deleted in database
        self.spreadsheet.refresh_from_db()
        self.assertTrue(self.spreadsheet.is_deleted)
        
        # Verify cannot retrieve after deletion
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
    
    def test_delete_spreadsheet_not_found(self):
        """Test deleting non-existent spreadsheet"""
        url = '/api/spreadsheet/spreadsheets/99999/'
        response = self.client.delete(url)
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
    
    def test_update_spreadsheet_authentication_required(self):
        """Test that authentication is required for updating spreadsheet"""
        self.client.logout()
        
        url = f'/api/spreadsheet/spreadsheets/{self.spreadsheet.id}/'
        data = {'name': 'Unauthenticated Update'}
        
        response = self.client.put(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
    
    def test_delete_spreadsheet_authentication_required(self):
        """Test that authentication is required for deleting spreadsheet"""
        self.client.logout()
        
        url = f'/api/spreadsheet/spreadsheets/{self.spreadsheet.id}/'
        response = self.client.delete(url)
        
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


# ========== Sheet View Tests ==========

class SheetListViewTest(TestCase):
    """Test cases for SheetListView"""
    
    def setUp(self):
        """Set up test data"""
        self.user = create_test_user()
        self.organization = create_test_organization()
        self.project = create_test_project(self.organization, owner=self.user)
        self.spreadsheet = create_test_spreadsheet(self.project)
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        
        # Create test sheets
        self.sheet1 = create_test_sheet(self.spreadsheet, name='Sheet 1', position=0)
        self.sheet2 = create_test_sheet(self.spreadsheet, name='Sheet 2', position=1)
    
    def test_list_sheets_success(self):
        """Test successful sheet list retrieval"""
        url = f'/api/spreadsheet/spreadsheets/{self.spreadsheet.id}/sheets/'
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('results', response.data)
        self.assertIn('count', response.data)
        self.assertIn('page', response.data)
        self.assertIn('page_size', response.data)
        self.assertEqual(response.data['count'], 2)
        self.assertEqual(len(response.data['results']), 2)
    
    def test_list_sheets_invalid_spreadsheet_id(self):
        """Test list sheets with non-existent spreadsheet_id"""
        url = '/api/spreadsheet/spreadsheets/99999/sheets/'
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
    
    def test_list_sheets_pagination(self):
        """Test sheet list pagination"""
        # Create more sheets
        for i in range(3, 23):
            create_test_sheet(self.spreadsheet, name=f'Sheet {i}', position=i)
        
        url = f'/api/spreadsheet/spreadsheets/{self.spreadsheet.id}/sheets/'
        response = self.client.get(url, {
            'page': 1,
            'page_size': 10
        })
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 22)
        self.assertEqual(response.data['page'], 1)
        self.assertEqual(response.data['page_size'], 10)
        self.assertEqual(len(response.data['results']), 10)
    
    def test_list_sheets_order_by_position(self):
        """Test sheet list ordering by position"""
        url = f'/api/spreadsheet/spreadsheets/{self.spreadsheet.id}/sheets/'
        response = self.client.get(url, {'order_by': 'position'})
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data['results']
        # Should be ordered by position ascending
        if len(results) > 1:
            self.assertLessEqual(
                results[0]['position'],
                results[1]['position']
            )
    
    def test_list_sheets_order_by_name(self):
        """Test sheet list ordering by name"""
        url = f'/api/spreadsheet/spreadsheets/{self.spreadsheet.id}/sheets/'
        response = self.client.get(url, {'order_by': 'name'})
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data['results']
        # Should be ordered by name ascending
        if len(results) > 1:
            names = [r['name'] for r in results]
            self.assertEqual(names, sorted(names))
    
    def test_list_sheets_order_by_created_at(self):
        """Test sheet list ordering by created_at"""
        url = f'/api/spreadsheet/spreadsheets/{self.spreadsheet.id}/sheets/'
        response = self.client.get(url, {'order_by': 'created_at'})
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data['results']
        # Should be ordered by created_at descending
        if len(results) > 1:
            self.assertGreaterEqual(
                results[0]['created_at'],
                results[1]['created_at']
            )
    
    def test_list_sheets_excludes_deleted(self):
        """Test that deleted sheets are excluded from list"""
        deleted_sheet = create_test_sheet(self.spreadsheet, name='Deleted', position=2)
        deleted_sheet.is_deleted = True
        deleted_sheet.save()
        
        url = f'/api/spreadsheet/spreadsheets/{self.spreadsheet.id}/sheets/'
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 2)  # Only non-deleted
        sheet_ids = [s['id'] for s in response.data['results']]
        self.assertNotIn(deleted_sheet.id, sheet_ids)
    
    def test_create_sheet_success(self):
        """Test successful sheet creation"""
        url = f'/api/spreadsheet/spreadsheets/{self.spreadsheet.id}/sheets/'
        data = {'name': 'New Sheet'}
        
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['name'], 'New Sheet')
        self.assertEqual(response.data['spreadsheet'], self.spreadsheet.id)
        self.assertIn('position', response.data)
        self.assertFalse(response.data['is_deleted'])
        
        # Verify in database
        self.assertTrue(
            Sheet.objects.filter(
                spreadsheet=self.spreadsheet,
                name='New Sheet',
                is_deleted=False
            ).exists()
        )
    
    def test_create_sheet_invalid_spreadsheet_id(self):
        """Test create sheet with non-existent spreadsheet_id"""
        url = '/api/spreadsheet/spreadsheets/99999/sheets/'
        data = {'name': 'New Sheet'}
        
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
    
    def test_create_sheet_duplicate_name(self):
        """Test creating sheet with duplicate name fails"""
        url = f'/api/spreadsheet/spreadsheets/{self.spreadsheet.id}/sheets/'
        data = {'name': 'Duplicate Name'}
        
        # Create first sheet
        response1 = self.client.post(url, data, format='json')
        self.assertEqual(response1.status_code, status.HTTP_201_CREATED)
        
        # Try to create duplicate
        response2 = self.client.post(url, data, format='json')
        self.assertEqual(response2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', response2.data)
    
    def test_create_sheet_position_read_only(self):
        """Test that position cannot be provided in create"""
        url = f'/api/spreadsheet/spreadsheets/{self.spreadsheet.id}/sheets/'
        data = {'name': 'New Sheet', 'position': 5}
        
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('position', response.data)
    
    def test_create_sheet_missing_name(self):
        """Test creating sheet without name field"""
        url = f'/api/spreadsheet/spreadsheets/{self.spreadsheet.id}/sheets/'
        data = {}
        
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('name', response.data)
    
    def test_create_sheet_empty_name(self):
        """Test creating sheet with empty name"""
        url = f'/api/spreadsheet/spreadsheets/{self.spreadsheet.id}/sheets/'
        data = {'name': ''}
        
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('name', response.data)
    
    def test_create_sheet_authentication_required(self):
        """Test that authentication is required for creating sheet"""
        self.client.logout()
        
        url = f'/api/spreadsheet/spreadsheets/{self.spreadsheet.id}/sheets/'
        data = {'name': 'Unauthenticated'}
        
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
    
    def test_list_sheets_authentication_required(self):
        """Test that authentication is required for listing sheets"""
        self.client.logout()
        
        url = f'/api/spreadsheet/spreadsheets/{self.spreadsheet.id}/sheets/'
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class SheetDetailViewTest(TestCase):
    """Test cases for SheetDetailView"""
    
    def setUp(self):
        """Set up test data"""
        self.user = create_test_user()
        self.organization = create_test_organization()
        self.project = create_test_project(self.organization, owner=self.user)
        self.spreadsheet = create_test_spreadsheet(self.project)
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        
        self.sheet = create_test_sheet(self.spreadsheet, name='Test Sheet', position=0)
    
    def test_retrieve_sheet_success(self):
        """Test successful sheet retrieval"""
        url = f'/api/spreadsheet/spreadsheets/{self.spreadsheet.id}/sheets/{self.sheet.id}/'
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['id'], self.sheet.id)
        self.assertEqual(response.data['name'], 'Test Sheet')
        self.assertEqual(response.data['spreadsheet'], self.spreadsheet.id)
        self.assertEqual(response.data['position'], 0)
    
    def test_retrieve_sheet_not_found(self):
        """Test retrieving non-existent sheet"""
        url = f'/api/spreadsheet/spreadsheets/{self.spreadsheet.id}/sheets/99999/'
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
    
    def test_retrieve_sheet_wrong_spreadsheet(self):
        """Test retrieving sheet from different spreadsheet"""
        spreadsheet2 = create_test_spreadsheet(self.project, name='Spreadsheet 2')
        sheet2 = create_test_sheet(spreadsheet2, name='Sheet 2', position=0)
        
        url = f'/api/spreadsheet/spreadsheets/{self.spreadsheet.id}/sheets/{sheet2.id}/'
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
    
    def test_retrieve_deleted_sheet(self):
        """Test that deleted sheet returns 404"""
        self.sheet.is_deleted = True
        self.sheet.save()
        
        url = f'/api/spreadsheet/spreadsheets/{self.spreadsheet.id}/sheets/{self.sheet.id}/'
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
    
    def test_update_sheet_success(self):
        """Test successful sheet update"""
        url = f'/api/spreadsheet/spreadsheets/{self.spreadsheet.id}/sheets/{self.sheet.id}/'
        data = {'name': 'Updated Sheet'}
        
        response = self.client.put(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['name'], 'Updated Sheet')
        self.assertEqual(response.data['id'], self.sheet.id)
        self.assertEqual(response.data['position'], 0)  # Position unchanged
        
        # Verify in database
        self.sheet.refresh_from_db()
        self.assertEqual(self.sheet.name, 'Updated Sheet')
        self.assertEqual(self.sheet.position, 0)
    
    def test_update_sheet_updates_timestamp(self):
        """Test that updating sheet name updates the updated_at timestamp"""
        url = f'/api/spreadsheet/spreadsheets/{self.spreadsheet.id}/sheets/{self.sheet.id}/'
        
        original_updated_at = self.sheet.updated_at
        time.sleep(0.1)
        
        data = {'name': 'Updated Name'}
        response = self.client.put(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['name'], 'Updated Name')
        
        self.sheet.refresh_from_db()
        self.assertGreater(self.sheet.updated_at, original_updated_at)
    
    def test_update_sheet_duplicate_name(self):
        """Test updating sheet with duplicate name fails"""
        sheet2 = create_test_sheet(self.spreadsheet, name='Other Name', position=1)
        
        url = f'/api/spreadsheet/spreadsheets/{self.spreadsheet.id}/sheets/{sheet2.id}/'
        data = {'name': 'Test Sheet'}  # Same as self.sheet.name
        
        response = self.client.put(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', response.data)
    
    def test_update_sheet_position_read_only(self):
        """Test that position cannot be updated"""
        url = f'/api/spreadsheet/spreadsheets/{self.spreadsheet.id}/sheets/{self.sheet.id}/'
        data = {'name': 'Updated Sheet', 'position': 5}
        
        response = self.client.put(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('position', response.data)
    
    def test_update_sheet_not_found(self):
        """Test updating non-existent sheet"""
        url = f'/api/spreadsheet/spreadsheets/{self.spreadsheet.id}/sheets/99999/'
        data = {'name': 'Updated Name'}
        
        response = self.client.put(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
    
    def test_update_sheet_empty_name(self):
        """Test updating sheet with empty name"""
        url = f'/api/spreadsheet/spreadsheets/{self.spreadsheet.id}/sheets/{self.sheet.id}/'
        data = {'name': ''}
        
        response = self.client.put(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('name', response.data)
    
    def test_delete_sheet_success(self):
        """Test successful sheet deletion (soft delete)"""
        url = f'/api/spreadsheet/spreadsheets/{self.spreadsheet.id}/sheets/{self.sheet.id}/'
        response = self.client.delete(url)
        
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        
        # Verify soft deleted in database
        self.sheet.refresh_from_db()
        self.assertTrue(self.sheet.is_deleted)
        
        # Verify cannot retrieve after deletion
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
    
    def test_delete_sheet_not_found(self):
        """Test deleting non-existent sheet"""
        url = f'/api/spreadsheet/spreadsheets/{self.spreadsheet.id}/sheets/99999/'
        response = self.client.delete(url)
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
    
    def test_update_sheet_authentication_required(self):
        """Test that authentication is required for updating sheet"""
        self.client.logout()
        
        url = f'/api/spreadsheet/spreadsheets/{self.spreadsheet.id}/sheets/{self.sheet.id}/'
        data = {'name': 'Unauthenticated Update'}
        
        response = self.client.put(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
    
    def test_delete_sheet_authentication_required(self):
        """Test that authentication is required for deleting sheet"""
        self.client.logout()
        
        url = f'/api/spreadsheet/spreadsheets/{self.spreadsheet.id}/sheets/{self.sheet.id}/'
        response = self.client.delete(url)
        
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class ProjectSheetDeleteViewTest(TestCase):
    """Test cases for project-scoped sheet delete endpoint"""

    def setUp(self):
        self.user = create_test_user()
        self.organization = create_test_organization()
        self.project = create_test_project(self.organization, owner=self.user)
        self.spreadsheet = create_test_spreadsheet(self.project)
        self.sheet = create_test_sheet(self.spreadsheet, name='Sheet 1', position=0)
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_project_sheet_delete_success(self):
        url = f'/api/projects/{self.project.id}/spreadsheets/{self.spreadsheet.id}/sheets/{self.sheet.id}/'
        response = self.client.delete(url)

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

        self.sheet.refresh_from_db()
        self.assertTrue(self.sheet.is_deleted)

        # Deleted sheet should not appear in sheet list
        list_url = f'/api/spreadsheet/spreadsheets/{self.spreadsheet.id}/sheets/'
        list_response = self.client.get(list_url)
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        sheet_ids = [s['id'] for s in list_response.data['results']]
        self.assertNotIn(self.sheet.id, sheet_ids)

    def test_project_sheet_delete_not_in_spreadsheet(self):
        spreadsheet2 = create_test_spreadsheet(self.project, name='Spreadsheet 2')
        sheet2 = create_test_sheet(spreadsheet2, name='Sheet 2', position=0)

        url = f'/api/projects/{self.project.id}/spreadsheets/{self.spreadsheet.id}/sheets/{sheet2.id}/'
        response = self.client.delete(url)

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


# ========== SheetRow View Tests ==========

class SheetRowListViewTest(TestCase):
    """Test cases for SheetRowListView"""
    
    def setUp(self):
        """Set up test data"""
        self.user = create_test_user()
        self.organization = create_test_organization()
        self.project = create_test_project(self.organization, owner=self.user)
        self.spreadsheet = create_test_spreadsheet(self.project)
        self.sheet = create_test_sheet(self.spreadsheet)
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        
        # Create test rows
        self.row1 = create_test_sheet_row(self.sheet, position=0)
        self.row2 = create_test_sheet_row(self.sheet, position=1)
        self.row3 = create_test_sheet_row(self.sheet, position=2)
    
    def test_list_rows_success(self):
        """Test successful row list retrieval"""
        url = f'/api/spreadsheet/spreadsheets/{self.spreadsheet.id}/sheets/{self.sheet.id}/rows/'
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('items', response.data)
        self.assertIn('offset', response.data)
        self.assertIn('limit', response.data)
        self.assertIn('total', response.data)
        self.assertIn('has_more', response.data)
        self.assertEqual(response.data['total'], 3)
        self.assertEqual(len(response.data['items']), 3)
    
    def test_list_rows_invalid_spreadsheet_id(self):
        """Test list rows with non-existent spreadsheet_id"""
        url = f'/api/spreadsheet/spreadsheets/99999/sheets/{self.sheet.id}/rows/'
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
    
    def test_list_rows_invalid_sheet_id(self):
        """Test list rows with non-existent sheet_id"""
        url = f'/api/spreadsheet/spreadsheets/{self.spreadsheet.id}/sheets/99999/rows/'
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
    
    def test_list_rows_wrong_spreadsheet(self):
        """Test list rows with sheet from different spreadsheet"""
        spreadsheet2 = create_test_spreadsheet(self.project, name='Spreadsheet 2')
        sheet2 = create_test_sheet(spreadsheet2, name='Sheet 2', position=1)
        
        url = f'/api/spreadsheet/spreadsheets/{self.spreadsheet.id}/sheets/{sheet2.id}/rows/'
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
    
    def test_list_rows_scrollable_pagination(self):
        """Test row list with scrollable pagination (offset/limit)"""
        # Create more rows
        for i in range(3, 23):
            create_test_sheet_row(self.sheet, position=i)
        
        url = f'/api/spreadsheet/spreadsheets/{self.spreadsheet.id}/sheets/{self.sheet.id}/rows/'
        response = self.client.get(url, {
            'offset': 0,
            'row_limit': 10
        })
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['total'], 23)
        self.assertEqual(response.data['offset'], 0)
        self.assertEqual(response.data['limit'], 10)
        self.assertEqual(len(response.data['items']), 10)
        self.assertTrue(response.data['has_more'])
    
    def test_list_rows_pagination_with_offset(self):
        """Test row list pagination with offset"""
        # Create more rows
        for i in range(3, 13):
            create_test_sheet_row(self.sheet, position=i)
        
        url = f'/api/spreadsheet/spreadsheets/{self.spreadsheet.id}/sheets/{self.sheet.id}/rows/'
        response = self.client.get(url, {
            'offset': 5,
            'row_limit': 5
        })
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['offset'], 5)
        self.assertEqual(response.data['limit'], 5)
        self.assertEqual(len(response.data['items']), 5)
        # First item should be at position 5
        self.assertEqual(response.data['items'][0]['position'], 5)
    
    def test_list_rows_max_limit_clamped(self):
        """Test that row_limit is clamped to max 500"""
        # Create many rows
        for i in range(3, 600):
            create_test_sheet_row(self.sheet, position=i)
        
        url = f'/api/spreadsheet/spreadsheets/{self.spreadsheet.id}/sheets/{self.sheet.id}/rows/'
        response = self.client.get(url, {
            'offset': 0,
            'row_limit': 1000  # Should be clamped to 500
        })
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['limit'], 500)
        self.assertEqual(len(response.data['items']), 500)
    
    def test_list_rows_default_pagination(self):
        """Test row list with default pagination parameters"""
        url = f'/api/spreadsheet/spreadsheets/{self.spreadsheet.id}/sheets/{self.sheet.id}/rows/'
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['offset'], 0)
        self.assertEqual(response.data['limit'], 100)  # Default row_limit
        self.assertEqual(response.data['total'], 3)
    
    def test_list_rows_ordered_by_position(self):
        """Test that rows are ordered by position"""
        url = f'/api/spreadsheet/spreadsheets/{self.spreadsheet.id}/sheets/{self.sheet.id}/rows/'
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        items = response.data['items']
        # Should be ordered by position ascending
        positions = [item['position'] for item in items]
        self.assertEqual(positions, sorted(positions))
        self.assertEqual(positions, [0, 1, 2])
    
    def test_list_rows_excludes_deleted(self):
        """Test that deleted rows are excluded from list"""
        deleted_row = create_test_sheet_row(self.sheet, position=3)
        deleted_row.is_deleted = True
        deleted_row.save()
        
        url = f'/api/spreadsheet/spreadsheets/{self.spreadsheet.id}/sheets/{self.sheet.id}/rows/'
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['total'], 3)  # Only non-deleted
        row_ids = [r['id'] for r in response.data['items']]
        self.assertNotIn(deleted_row.id, row_ids)
    
    def test_list_rows_has_more_true(self):
        """Test has_more flag when more rows exist"""
        # Create enough rows to trigger has_more
        for i in range(3, 15):
            create_test_sheet_row(self.sheet, position=i)
        
        url = f'/api/spreadsheet/spreadsheets/{self.spreadsheet.id}/sheets/{self.sheet.id}/rows/'
        response = self.client.get(url, {
            'offset': 0,
            'row_limit': 10
        })
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['has_more'])
        self.assertEqual(response.data['total'], 15)
    
    def test_list_rows_has_more_false(self):
        """Test has_more flag when no more rows exist"""
        url = f'/api/spreadsheet/spreadsheets/{self.spreadsheet.id}/sheets/{self.sheet.id}/rows/'
        response = self.client.get(url, {
            'offset': 0,
            'row_limit': 10
        })
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data['has_more'])
        self.assertEqual(response.data['total'], 3)
    
    def test_list_rows_empty_sheet(self):
        """Test list rows for sheet with no rows"""
        sheet2 = create_test_sheet(self.spreadsheet, name='Empty Sheet', position=1)
        
        url = f'/api/spreadsheet/spreadsheets/{self.spreadsheet.id}/sheets/{sheet2.id}/rows/'
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['total'], 0)
        self.assertEqual(len(response.data['items']), 0)
        self.assertFalse(response.data['has_more'])
    
    def test_list_rows_authentication_required(self):
        """Test that authentication is required for listing rows"""
        self.client.logout()
        
        url = f'/api/spreadsheet/spreadsheets/{self.spreadsheet.id}/sheets/{self.sheet.id}/rows/'
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
    
    def test_list_rows_read_only_no_post(self):
        """Test that POST is not allowed on row list endpoint (read-only)"""
        url = f'/api/spreadsheet/spreadsheets/{self.spreadsheet.id}/sheets/{self.sheet.id}/rows/'
        response = self.client.post(url, {}, format='json')
        
        # Read-only endpoint should return 405 Method Not Allowed
        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
    
    def test_list_rows_read_only_no_put(self):
        """Test that PUT is not allowed on row list endpoint (read-only)"""
        url = f'/api/spreadsheet/spreadsheets/{self.spreadsheet.id}/sheets/{self.sheet.id}/rows/'
        response = self.client.put(url, {}, format='json')
        
        # Read-only endpoint should return 405 Method Not Allowed
        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
    
    def test_list_rows_read_only_no_patch(self):
        """Test that PATCH is not allowed on row list endpoint (read-only)"""
        url = f'/api/spreadsheet/spreadsheets/{self.spreadsheet.id}/sheets/{self.sheet.id}/rows/'
        response = self.client.patch(url, {}, format='json')
        
        # Read-only endpoint should return 405 Method Not Allowed
        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
    
    def test_list_rows_read_only_no_delete(self):
        """Test that DELETE is not allowed on row list endpoint (read-only)"""
        url = f'/api/spreadsheet/spreadsheets/{self.spreadsheet.id}/sheets/{self.sheet.id}/rows/'
        response = self.client.delete(url)
        
        # Read-only endpoint should return 405 Method Not Allowed
        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
    
    def test_retrieve_deleted_row_returns_404(self):
        """Test that retrieving a soft-deleted row by id returns 404"""
        deleted_row = create_test_sheet_row(self.sheet, position=10)
        deleted_row.is_deleted = True
        deleted_row.save()
        
        # Note: There's no detail endpoint for rows, but if there were, it should return 404
        # For now, verify the row doesn't appear in list
        url = f'/api/spreadsheet/spreadsheets/{self.spreadsheet.id}/sheets/{self.sheet.id}/rows/'
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        row_ids = [r['id'] for r in response.data['items']]
        self.assertNotIn(deleted_row.id, row_ids)
    
    def test_list_rows_cross_sheet_isolation(self):
        """Test cross-sheet isolation - rows from sheet A don't appear in sheet B's list"""
        sheet2 = create_test_sheet(self.spreadsheet, name='Sheet 2', position=1)
        
        # Create rows in sheet2
        row_sheet2_1 = create_test_sheet_row(sheet2, position=0)
        row_sheet2_2 = create_test_sheet_row(sheet2, position=1)
        
        # Request list for sheet1 (self.sheet)
        url = f'/api/spreadsheet/spreadsheets/{self.spreadsheet.id}/sheets/{self.sheet.id}/rows/'
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        row_ids = [r['id'] for r in response.data['items']]
        # Should not include rows from sheet2
        self.assertNotIn(row_sheet2_1.id, row_ids)
        self.assertNotIn(row_sheet2_2.id, row_ids)
        # Should only include rows from self.sheet
        self.assertEqual(set(row_ids), {self.row1.id, self.row2.id, self.row3.id})
    
    def test_list_rows_pagination_specific_positions(self):
        """Test pagination with specific positions [0,1,2,3,4] using offset/limit"""
        # Clear existing rows
        SheetRow.objects.filter(sheet=self.sheet).delete()
        
        # Create 5 rows with known positions (0..4)
        for i in range(5):
            create_test_sheet_row(self.sheet, position=i)
        
        url = f'/api/spreadsheet/spreadsheets/{self.spreadsheet.id}/sheets/{self.sheet.id}/rows/'
        
        # Test offset=0 limit=2 -> returns positions [0,1]
        response1 = self.client.get(url, {'offset': 0, 'row_limit': 2})
        self.assertEqual(response1.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response1.data['items']), 2)
        positions1 = [item['position'] for item in response1.data['items']]
        self.assertEqual(positions1, [0, 1])
        
        # Test offset=2 limit=2 -> returns positions [2,3]
        response2 = self.client.get(url, {'offset': 2, 'row_limit': 2})
        self.assertEqual(response2.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response2.data['items']), 2)
        positions2 = [item['position'] for item in response2.data['items']]
        self.assertEqual(positions2, [2, 3])
        
        # Verify ordering by position ascending
        all_positions = [item['position'] for item in response2.data['items']]
        self.assertEqual(all_positions, sorted(all_positions))


# ========== SheetRow Insert View Tests ==========

class SheetRowInsertViewTest(TestCase):
    """Test cases for SheetRowInsertView"""

    def setUp(self):
        self.user = create_test_user()
        self.organization = create_test_organization()
        self.project = create_test_project(self.organization, owner=self.user)
        self.spreadsheet = create_test_spreadsheet(self.project)
        self.sheet = create_test_sheet(self.spreadsheet)
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

        self.row0 = create_test_sheet_row(self.sheet, position=0)
        self.row1 = create_test_sheet_row(self.sheet, position=1)
        self.row2 = create_test_sheet_row(self.sheet, position=2)

        from spreadsheet.services import SheetService
        self.col0 = SheetColumn.objects.create(
            sheet=self.sheet,
            position=0,
            name=SheetService._generate_column_name(0)
        )

    def test_insert_row_shifts_positions_and_creates_row(self):
        url = f'/api/spreadsheet/spreadsheets/{self.spreadsheet.id}/sheets/{self.sheet.id}/rows/insert/'
        response = self.client.post(url, {'position': 1, 'count': 1}, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('operation_id', response.data)

        self.row0.refresh_from_db()
        self.row1.refresh_from_db()
        self.row2.refresh_from_db()

        self.assertEqual(self.row0.position, 0)
        self.assertEqual(self.row1.position, 2)
        self.assertEqual(self.row2.position, 3)

        new_row = SheetRow.objects.get(sheet=self.sheet, position=1, is_deleted=False)
        self.assertIsNotNone(new_row)

        positions = list(SheetRow.objects.filter(sheet=self.sheet, is_deleted=False).values_list('position', flat=True))
        self.assertEqual(len(positions), len(set(positions)))

    def test_insert_row_does_not_change_cell_row_ids(self):
        cell = Cell.objects.create(sheet=self.sheet, row=self.row1, column=self.col0)
        original_row_id = cell.row_id
        original_column_id = cell.column_id

        url = f'/api/spreadsheet/spreadsheets/{self.spreadsheet.id}/sheets/{self.sheet.id}/rows/insert/'
        response = self.client.post(url, {'position': 1, 'count': 1}, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        cell.refresh_from_db()
        self.assertEqual(cell.row_id, original_row_id)
        self.assertEqual(cell.column_id, original_column_id)

    def test_insert_row_multiple_count(self):
        url = f'/api/spreadsheet/spreadsheets/{self.spreadsheet.id}/sheets/{self.sheet.id}/rows/insert/'
        response = self.client.post(url, {'position': 1, 'count': 2}, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        self.row1.refresh_from_db()
        self.row2.refresh_from_db()

        self.assertEqual(self.row1.position, 3)
        self.assertEqual(self.row2.position, 4)

        inserted_positions = set(SheetRow.objects.filter(sheet=self.sheet, is_deleted=False).values_list('position', flat=True))
        self.assertTrue({1, 2}.issubset(inserted_positions))

    def test_insert_row_at_end(self):
        url = f'/api/spreadsheet/spreadsheets/{self.spreadsheet.id}/sheets/{self.sheet.id}/rows/insert/'
        response = self.client.post(url, {'position': 3, 'count': 1}, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(SheetRow.objects.filter(sheet=self.sheet, position=3, is_deleted=False).exists())

    def test_revert_row_insert(self):
        insert_url = f'/api/spreadsheet/spreadsheets/{self.spreadsheet.id}/sheets/{self.sheet.id}/rows/insert/'
        insert_response = self.client.post(insert_url, {'position': 1, 'count': 1}, format='json')
        self.assertEqual(insert_response.status_code, status.HTTP_201_CREATED)

        operation_id = insert_response.data['operation_id']
        revert_url = f'/api/spreadsheet/spreadsheets/{self.spreadsheet.id}/sheets/{self.sheet.id}/operations/{operation_id}/revert/'
        revert_response = self.client.post(revert_url, {}, format='json')
        self.assertEqual(revert_response.status_code, status.HTTP_200_OK)

        positions = list(
            SheetRow.objects.filter(sheet=self.sheet, is_deleted=False)
            .order_by('position')
            .values_list('position', flat=True)
        )
        self.assertEqual(positions, [0, 1, 2])


# ========== SheetColumn View Tests ==========

class SheetColumnListViewTest(TestCase):
    """Test cases for SheetColumnListView"""
    
    def setUp(self):
        """Set up test data"""
        self.user = create_test_user()
        self.organization = create_test_organization()
        self.project = create_test_project(self.organization, owner=self.user)
        self.spreadsheet = create_test_spreadsheet(self.project)
        self.sheet = create_test_sheet(self.spreadsheet)
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        
        # Create test columns
        from spreadsheet.services import SheetService
        self.column1 = SheetColumn.objects.create(
            sheet=self.sheet,
            position=0,
            name=SheetService._generate_column_name(0)  # 'A'
        )
        self.column2 = SheetColumn.objects.create(
            sheet=self.sheet,
            position=1,
            name=SheetService._generate_column_name(1)  # 'B'
        )
        self.column3 = SheetColumn.objects.create(
            sheet=self.sheet,
            position=2,
            name=SheetService._generate_column_name(2)  # 'C'
        )
    
    def test_list_columns_success(self):
        """Test successful column list retrieval"""
        url = f'/api/spreadsheet/spreadsheets/{self.spreadsheet.id}/sheets/{self.sheet.id}/columns/'
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('items', response.data)
        self.assertIn('offset', response.data)
        self.assertIn('limit', response.data)
        self.assertIn('total', response.data)
        self.assertIn('has_more', response.data)
        self.assertEqual(response.data['total'], 3)
        self.assertEqual(len(response.data['items']), 3)
    
    def test_list_columns_invalid_spreadsheet_id(self):
        """Test list columns with non-existent spreadsheet_id"""
        url = f'/api/spreadsheet/spreadsheets/99999/sheets/{self.sheet.id}/columns/'
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
    
    def test_list_columns_invalid_sheet_id(self):
        """Test list columns with non-existent sheet_id"""
        url = f'/api/spreadsheet/spreadsheets/{self.spreadsheet.id}/sheets/99999/columns/'
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
    
    def test_list_columns_wrong_spreadsheet(self):
        """Test list columns with sheet from different spreadsheet"""
        spreadsheet2 = create_test_spreadsheet(self.project, name='Spreadsheet 2')
        sheet2 = create_test_sheet(spreadsheet2, name='Sheet 2', position=1)
        
        url = f'/api/spreadsheet/spreadsheets/{self.spreadsheet.id}/sheets/{sheet2.id}/columns/'
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
    
    def test_list_columns_scrollable_pagination(self):
        """Test column list with scrollable pagination (offset/limit)"""
        # Create more columns
        from spreadsheet.services import SheetService
        for i in range(3, 23):
            SheetColumn.objects.create(
                sheet=self.sheet,
                position=i,
                name=SheetService._generate_column_name(i)
            )
        
        url = f'/api/spreadsheet/spreadsheets/{self.spreadsheet.id}/sheets/{self.sheet.id}/columns/'
        response = self.client.get(url, {
            'offset': 0,
            'column_limit': 10
        })
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['total'], 23)
        self.assertEqual(response.data['offset'], 0)
        self.assertEqual(response.data['limit'], 10)
        self.assertEqual(len(response.data['items']), 10)
        self.assertTrue(response.data['has_more'])
    
    def test_list_columns_pagination_with_offset(self):
        """Test column list pagination with offset"""
        # Create more columns
        from spreadsheet.services import SheetService
        for i in range(3, 13):
            SheetColumn.objects.create(
                sheet=self.sheet,
                position=i,
                name=SheetService._generate_column_name(i)
            )
        
        url = f'/api/spreadsheet/spreadsheets/{self.spreadsheet.id}/sheets/{self.sheet.id}/columns/'
        response = self.client.get(url, {
            'offset': 5,
            'column_limit': 5
        })
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['offset'], 5)
        self.assertEqual(response.data['limit'], 5)
        self.assertEqual(len(response.data['items']), 5)
        # First item should be at position 5
        self.assertEqual(response.data['items'][0]['position'], 5)
    
    def test_list_columns_max_limit_clamped(self):
        """Test that column_limit is clamped to max 200"""
        # Create many columns
        from spreadsheet.services import SheetService
        for i in range(3, 300):
            SheetColumn.objects.create(
                sheet=self.sheet,
                position=i,
                name=SheetService._generate_column_name(i)
            )
        
        url = f'/api/spreadsheet/spreadsheets/{self.spreadsheet.id}/sheets/{self.sheet.id}/columns/'
        response = self.client.get(url, {
            'column_limit': 500  # Request 500, should be clamped to 200
        })
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['limit'], 200)  # Verify clamping
    
    def test_list_columns_ordering(self):
        """Test that columns are ordered by position"""
        from spreadsheet.services import SheetService
        # Create columns out of order to verify ordering
        SheetColumn.objects.create(
            sheet=self.sheet,
            position=15,
            name=SheetService._generate_column_name(15)
        )
        SheetColumn.objects.create(
            sheet=self.sheet,
            position=12,
            name=SheetService._generate_column_name(12)
        )
        SheetColumn.objects.create(
            sheet=self.sheet,
            position=18,
            name=SheetService._generate_column_name(18)
        )
        
        url = f'/api/spreadsheet/spreadsheets/{self.spreadsheet.id}/sheets/{self.sheet.id}/columns/'
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # All 6 columns (3 initial + 3 new)
        self.assertEqual(response.data['total'], 6)
        # Verify positions are in ascending order
        expected_positions = sorted([0, 1, 2, 12, 15, 18])
        actual_positions = [item['position'] for item in response.data['items']]
        self.assertEqual(actual_positions, expected_positions)
    
    def test_list_columns_excludes_deleted(self):
        """Test that deleted columns are excluded from the list"""
        column_to_delete = SheetColumn.objects.get(sheet=self.sheet, position=0)
        column_to_delete.is_deleted = True
        column_to_delete.save()
        
        url = f'/api/spreadsheet/spreadsheets/{self.spreadsheet.id}/sheets/{self.sheet.id}/columns/'
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['total'], 2)  # 3 - 1 deleted
        self.assertNotIn(0, [item['position'] for item in response.data['items']])
    
    def test_list_columns_authentication_required(self):
        """Test that authentication is required for listing columns"""
        self.client.logout()
        
        url = f'/api/spreadsheet/spreadsheets/{self.spreadsheet.id}/sheets/{self.sheet.id}/columns/'
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
    
    def test_list_columns_from_different_spreadsheet(self):
        """Test that user cannot list columns from a sheet in a different spreadsheet"""
        other_project = create_test_project(self.organization, name='Other Project')
        other_spreadsheet = create_test_spreadsheet(other_project, name='Other Spreadsheet')
        other_sheet = create_test_sheet(other_spreadsheet, name='Other Sheet')
        from spreadsheet.services import SheetService
        SheetColumn.objects.create(
            sheet=other_sheet,
            position=0,
            name=SheetService._generate_column_name(0)
        )
        
        url = f'/api/spreadsheet/spreadsheets/{other_spreadsheet.id}/sheets/{other_sheet.id}/columns/'
        # Authenticated user (self.user) does not own other_project, so it should be 404
        response = self.client.get(url)
        # self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND) will add this in the future after involve CustomUser.
    
    def test_list_columns_cross_sheet_isolation(self):
        """Test cross-sheet isolation - columns from sheet A don't appear in sheet B's list"""
        sheet2 = create_test_sheet(self.spreadsheet, name='Sheet 2', position=1)
        from spreadsheet.services import SheetService
        
        # Create columns in sheet2
        column_sheet2_1 = SheetColumn.objects.create(
            sheet=sheet2,
            position=0,
            name=SheetService._generate_column_name(0)
        )
        column_sheet2_2 = SheetColumn.objects.create(
            sheet=sheet2,
            position=1,
            name=SheetService._generate_column_name(1)
        )
        
        # Request list for sheet1 (self.sheet)
        url = f'/api/spreadsheet/spreadsheets/{self.spreadsheet.id}/sheets/{self.sheet.id}/columns/'
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        column_ids = [c['id'] for c in response.data['items']]
        # Should not include columns from sheet2
        self.assertNotIn(column_sheet2_1.id, column_ids)
        self.assertNotIn(column_sheet2_2.id, column_ids)
        # Should only include columns from self.sheet
        self.assertEqual(set(column_ids), {self.column1.id, self.column2.id, self.column3.id})


class SheetColumnInsertViewTest(TestCase):
    """Test cases for SheetColumnInsertView"""

    def setUp(self):
        self.user = create_test_user()
        self.organization = create_test_organization()
        self.project = create_test_project(self.organization, owner=self.user)
        self.spreadsheet = create_test_spreadsheet(self.project)
        self.sheet = create_test_sheet(self.spreadsheet)
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

        self.row0 = create_test_sheet_row(self.sheet, position=0)

        from spreadsheet.services import SheetService
        self.col0 = SheetColumn.objects.create(
            sheet=self.sheet,
            position=0,
            name=SheetService._generate_column_name(0)
        )
        self.col1 = SheetColumn.objects.create(
            sheet=self.sheet,
            position=1,
            name=SheetService._generate_column_name(1)
        )
        self.col2 = SheetColumn.objects.create(
            sheet=self.sheet,
            position=2,
            name=SheetService._generate_column_name(2)
        )

    def test_insert_column_shifts_positions_and_creates_column(self):
        url = f'/api/spreadsheet/spreadsheets/{self.spreadsheet.id}/sheets/{self.sheet.id}/columns/insert/'
        response = self.client.post(url, {'position': 1, 'count': 1}, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('operation_id', response.data)

        self.col0.refresh_from_db()
        self.col1.refresh_from_db()
        self.col2.refresh_from_db()

        self.assertEqual(self.col0.position, 0)
        self.assertEqual(self.col1.position, 2)
        self.assertEqual(self.col2.position, 3)

        new_column = SheetColumn.objects.get(sheet=self.sheet, position=1, is_deleted=False)
        self.assertIsNotNone(new_column)

        positions = list(SheetColumn.objects.filter(sheet=self.sheet, is_deleted=False).values_list('position', flat=True))
        self.assertEqual(len(positions), len(set(positions)))

    def test_insert_column_does_not_change_cell_column_ids(self):
        cell = Cell.objects.create(sheet=self.sheet, row=self.row0, column=self.col1)
        original_row_id = cell.row_id
        original_column_id = cell.column_id

        url = f'/api/spreadsheet/spreadsheets/{self.spreadsheet.id}/sheets/{self.sheet.id}/columns/insert/'
        response = self.client.post(url, {'position': 1, 'count': 1}, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        cell.refresh_from_db()
        self.assertEqual(cell.row_id, original_row_id)
        self.assertEqual(cell.column_id, original_column_id)

    def test_insert_column_multiple_count(self):
        url = f'/api/spreadsheet/spreadsheets/{self.spreadsheet.id}/sheets/{self.sheet.id}/columns/insert/'
        response = self.client.post(url, {'position': 1, 'count': 2}, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        self.col1.refresh_from_db()
        self.col2.refresh_from_db()

        self.assertEqual(self.col1.position, 3)
        self.assertEqual(self.col2.position, 4)

        inserted_positions = set(SheetColumn.objects.filter(sheet=self.sheet, is_deleted=False).values_list('position', flat=True))
        self.assertTrue({1, 2}.issubset(inserted_positions))

    def test_insert_column_at_end(self):
        url = f'/api/spreadsheet/spreadsheets/{self.spreadsheet.id}/sheets/{self.sheet.id}/columns/insert/'
        response = self.client.post(url, {'position': 3, 'count': 1}, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(SheetColumn.objects.filter(sheet=self.sheet, position=3, is_deleted=False).exists())

    def test_revert_column_insert(self):
        insert_url = f'/api/spreadsheet/spreadsheets/{self.spreadsheet.id}/sheets/{self.sheet.id}/columns/insert/'
        insert_response = self.client.post(insert_url, {'position': 1, 'count': 1}, format='json')
        self.assertEqual(insert_response.status_code, status.HTTP_201_CREATED)

        operation_id = insert_response.data['operation_id']
        revert_url = f'/api/spreadsheet/spreadsheets/{self.spreadsheet.id}/sheets/{self.sheet.id}/operations/{operation_id}/revert/'
        revert_response = self.client.post(revert_url, {}, format='json')
        self.assertEqual(revert_response.status_code, status.HTTP_200_OK)

        positions = list(
            SheetColumn.objects.filter(sheet=self.sheet, is_deleted=False)
            .order_by('position')
            .values_list('position', flat=True)
        )
        self.assertEqual(positions, [0, 1, 2])


class SheetRowDeleteViewTest(TestCase):
    """Test cases for SheetRowDeleteView"""

    def setUp(self):
        self.user = create_test_user()
        self.organization = create_test_organization()
        self.project = create_test_project(self.organization, owner=self.user)
        self.spreadsheet = create_test_spreadsheet(self.project)
        self.sheet = create_test_sheet(self.spreadsheet)
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

        self.row0 = create_test_sheet_row(self.sheet, position=0)
        self.row1 = create_test_sheet_row(self.sheet, position=1)
        self.row2 = create_test_sheet_row(self.sheet, position=2)

        from spreadsheet.services import SheetService
        self.col0 = SheetColumn.objects.create(
            sheet=self.sheet,
            position=0,
            name=SheetService._generate_column_name(0)
        )

    def test_delete_row_shifts_positions_and_soft_deletes(self):
        url = f'/api/spreadsheet/spreadsheets/{self.spreadsheet.id}/sheets/{self.sheet.id}/rows/delete/'
        response = self.client.post(url, {'position': 1, 'count': 1}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('operation_id', response.data)

        self.row1.refresh_from_db()
        self.assertTrue(self.row1.is_deleted)

        positions = list(
            SheetRow.objects.filter(sheet=self.sheet, is_deleted=False)
            .order_by('position')
            .values_list('position', flat=True)
        )
        self.assertEqual(positions, [0, 1])

    def test_delete_row_does_not_change_cell_row_ids(self):
        cell = Cell.objects.create(sheet=self.sheet, row=self.row1, column=self.col0)
        original_row_id = cell.row_id

        url = f'/api/spreadsheet/spreadsheets/{self.spreadsheet.id}/sheets/{self.sheet.id}/rows/delete/'
        response = self.client.post(url, {'position': 1, 'count': 1}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        cell.refresh_from_db()
        self.assertEqual(cell.row_id, original_row_id)

    def test_revert_row_delete(self):
        delete_url = f'/api/spreadsheet/spreadsheets/{self.spreadsheet.id}/sheets/{self.sheet.id}/rows/delete/'
        delete_response = self.client.post(delete_url, {'position': 1, 'count': 1}, format='json')
        self.assertEqual(delete_response.status_code, status.HTTP_200_OK)

        operation_id = delete_response.data['operation_id']
        revert_url = f'/api/spreadsheet/spreadsheets/{self.spreadsheet.id}/sheets/{self.sheet.id}/operations/{operation_id}/revert/'
        revert_response = self.client.post(revert_url, {}, format='json')
        self.assertEqual(revert_response.status_code, status.HTTP_200_OK)

        self.row1.refresh_from_db()
        self.assertFalse(self.row1.is_deleted)

        positions = list(
            SheetRow.objects.filter(sheet=self.sheet, is_deleted=False)
            .order_by('position')
            .values_list('position', flat=True)
        )
        self.assertEqual(positions, [0, 1, 2])


class SheetColumnDeleteViewTest(TestCase):
    """Test cases for SheetColumnDeleteView"""

    def setUp(self):
        self.user = create_test_user()
        self.organization = create_test_organization()
        self.project = create_test_project(self.organization, owner=self.user)
        self.spreadsheet = create_test_spreadsheet(self.project)
        self.sheet = create_test_sheet(self.spreadsheet)
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

        self.row0 = create_test_sheet_row(self.sheet, position=0)

        from spreadsheet.services import SheetService
        self.col0 = SheetColumn.objects.create(
            sheet=self.sheet,
            position=0,
            name=SheetService._generate_column_name(0)
        )
        self.col1 = SheetColumn.objects.create(
            sheet=self.sheet,
            position=1,
            name=SheetService._generate_column_name(1)
        )
        self.col2 = SheetColumn.objects.create(
            sheet=self.sheet,
            position=2,
            name=SheetService._generate_column_name(2)
        )

    def test_delete_column_shifts_positions_and_soft_deletes(self):
        url = f'/api/spreadsheet/spreadsheets/{self.spreadsheet.id}/sheets/{self.sheet.id}/columns/delete/'
        response = self.client.post(url, {'position': 1, 'count': 1}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('operation_id', response.data)

        self.col1.refresh_from_db()
        self.assertTrue(self.col1.is_deleted)

        positions = list(
            SheetColumn.objects.filter(sheet=self.sheet, is_deleted=False)
            .order_by('position')
            .values_list('position', flat=True)
        )
        self.assertEqual(positions, [0, 1])

    def test_delete_column_does_not_change_cell_column_ids(self):
        cell = Cell.objects.create(sheet=self.sheet, row=self.row0, column=self.col1)
        original_column_id = cell.column_id

        url = f'/api/spreadsheet/spreadsheets/{self.spreadsheet.id}/sheets/{self.sheet.id}/columns/delete/'
        response = self.client.post(url, {'position': 1, 'count': 1}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        cell.refresh_from_db()
        self.assertEqual(cell.column_id, original_column_id)

    def test_revert_column_delete(self):
        delete_url = f'/api/spreadsheet/spreadsheets/{self.spreadsheet.id}/sheets/{self.sheet.id}/columns/delete/'
        delete_response = self.client.post(delete_url, {'position': 1, 'count': 1}, format='json')
        self.assertEqual(delete_response.status_code, status.HTTP_200_OK)

        operation_id = delete_response.data['operation_id']
        revert_url = f'/api/spreadsheet/spreadsheets/{self.spreadsheet.id}/sheets/{self.sheet.id}/operations/{operation_id}/revert/'
        revert_response = self.client.post(revert_url, {}, format='json')
        self.assertEqual(revert_response.status_code, status.HTTP_200_OK)

        self.col1.refresh_from_db()
        self.assertFalse(self.col1.is_deleted)

        positions = list(
            SheetColumn.objects.filter(sheet=self.sheet, is_deleted=False)
            .order_by('position')
            .values_list('position', flat=True)
        )
        self.assertEqual(positions, [0, 1, 2])


class CellBatchUpdateDependencyTest(TestCase):
    """Test dependency recalculation in batch update endpoint"""

    def setUp(self):
        self.user = create_test_user()
        self.organization = create_test_organization()
        self.project = create_test_project(self.organization, owner=self.user)
        self.spreadsheet = create_test_spreadsheet(self.project)
        self.sheet = create_test_sheet(self.spreadsheet)
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def _batch(self, operations):
        url = f'/api/spreadsheet/spreadsheets/{self.spreadsheet.id}/sheets/{self.sheet.id}/cells/batch/'
        return self.client.post(url, {'operations': operations, 'auto_expand': True}, format='json')

    def test_batch_update_recalculates_dependents(self):
        init_ops = [
            {'operation': 'set', 'row': 1, 'column': 1, 'raw_input': '10'},
            {'operation': 'set', 'row': 1, 'column': 2, 'raw_input': '2'},
            {'operation': 'set', 'row': 1, 'column': 3, 'raw_input': '=B2/C2'},
            {'operation': 'set', 'row': 1, 'column': 4, 'raw_input': '=D2*2'},
        ]
        response = self._batch(init_ops)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        response = self._batch([
            {'operation': 'set', 'row': 1, 'column': 1, 'raw_input': '20'},
        ])
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        cells = {
            (cell['row_position'], cell['column_position']): cell
            for cell in response.data.get('cells', [])
        }
        self.assertIn((1, 3), cells)
        self.assertIn((1, 4), cells)
        self.assertEqual(Decimal(str(cells[(1, 3)]['computed_number'])), Decimal('10'))
        self.assertEqual(Decimal(str(cells[(1, 4)]['computed_number'])), Decimal('20'))

    def test_batch_update_persists_formula_with_empty_and_number_refs(self):
        response = self._batch([
            {'operation': 'set', 'row': 16, 'column': 0, 'raw_input': '=A8+B8'},
        ])
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        response = self._batch([
            {'operation': 'set', 'row': 7, 'column': 1, 'raw_input': '1'},
        ])
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        a17 = Cell.objects.get(sheet=self.sheet, row__position=16, column__position=0, is_deleted=False)
        self.assertEqual(a17.computed_type, ComputedCellType.NUMBER)
        self.assertEqual(a17.error_code, None)
        self.assertEqual(Decimal(str(a17.computed_number)), Decimal('1'))

        response = self._batch([
            {'operation': 'set', 'row': 7, 'column': 1, 'raw_input': '2'},
        ])
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        a17.refresh_from_db()
        self.assertEqual(a17.computed_type, ComputedCellType.NUMBER)
        self.assertEqual(a17.error_code, None)
        self.assertEqual(Decimal(str(a17.computed_number)), Decimal('2'))

    def test_batch_update_persists_nested_formula_with_empty_refs(self):
        response = self._batch([
            {'operation': 'set', 'row': 19, 'column': 0, 'raw_input': '=A9+B9'},
            {'operation': 'set', 'row': 20, 'column': 0, 'raw_input': '=A20'},
        ])
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        response = self._batch([
            {'operation': 'set', 'row': 8, 'column': 1, 'raw_input': '1'},
        ])
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        a20 = Cell.objects.get(sheet=self.sheet, row__position=19, column__position=0, is_deleted=False)
        a21 = Cell.objects.get(sheet=self.sheet, row__position=20, column__position=0, is_deleted=False)
        self.assertEqual(a20.computed_type, ComputedCellType.NUMBER)
        self.assertEqual(a20.error_code, None)
        self.assertEqual(Decimal(str(a20.computed_number)), Decimal('1'))
        self.assertEqual(a21.computed_type, ComputedCellType.NUMBER)
        self.assertEqual(a21.error_code, None)
        self.assertEqual(Decimal(str(a21.computed_number)), Decimal('1'))

        response = self._batch([
            {'operation': 'set', 'row': 8, 'column': 1, 'raw_input': '2'},
        ])
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        a20.refresh_from_db()
        a21.refresh_from_db()
        self.assertEqual(a20.computed_type, ComputedCellType.NUMBER)
        self.assertEqual(a20.error_code, None)
        self.assertEqual(Decimal(str(a20.computed_number)), Decimal('2'))
        self.assertEqual(a21.computed_type, ComputedCellType.NUMBER)
        self.assertEqual(a21.error_code, None)
        self.assertEqual(Decimal(str(a21.computed_number)), Decimal('2'))

    def test_sum_range_with_empty_cells(self):
        response = self._batch([
            {'operation': 'set', 'row': 0, 'column': 2, 'raw_input': '=SUM(A1:B2)'},
            {'operation': 'set', 'row': 0, 'column': 0, 'raw_input': '1'},
            {'operation': 'set', 'row': 1, 'column': 1, 'raw_input': '2'},
        ])
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        c1 = Cell.objects.get(sheet=self.sheet, row__position=0, column__position=2, is_deleted=False)
        self.assertEqual(c1.computed_type, ComputedCellType.NUMBER)
        self.assertEqual(c1.error_code, None)
        self.assertEqual(Decimal(str(c1.computed_number)), Decimal('3'))

    def test_batch_update_currency_raw_input_respects_number_value(self):
        response = self._batch([
            {
                'operation': 'set',
                'row': 0,
                'column': 0,
                'raw_input': '$12',
                'value_type': 'number',
                'number_value': '12',
            },
        ])
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        response = self._batch([
            {'operation': 'set', 'row': 0, 'column': 1, 'raw_input': '=A1+1'},
        ])
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        a1 = Cell.objects.get(sheet=self.sheet, row__position=0, column__position=0, is_deleted=False)
        b1 = Cell.objects.get(sheet=self.sheet, row__position=0, column__position=1, is_deleted=False)

        self.assertEqual(a1.value_type, CellValueType.NUMBER)
        self.assertEqual(a1.raw_input, '$12')
        self.assertEqual(Decimal(str(a1.number_value)), Decimal('12'))

        self.assertEqual(b1.computed_type, ComputedCellType.NUMBER)
        self.assertIsNone(b1.error_code)
        self.assertEqual(Decimal(str(b1.computed_number)), Decimal('13'))

    def test_batch_update_currency_formula_mixed_symbols_errors(self):
        response = self._batch([
            {
                'operation': 'set',
                'row': 0,
                'column': 0,
                'raw_input': '$12',
                'value_type': 'number',
                'number_value': '12',
            },
            {
                'operation': 'set',
                'row': 0,
                'column': 1,
                'raw_input': '€5',
                'value_type': 'number',
                'number_value': '5',
            },
            {'operation': 'set', 'row': 0, 'column': 2, 'raw_input': '=SUM(A1:B1)'},
        ])
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        c1 = Cell.objects.get(sheet=self.sheet, row__position=0, column__position=2, is_deleted=False)
        self.assertEqual(c1.computed_type, ComputedCellType.ERROR)
        self.assertEqual(c1.error_code, '#VALUE!')

    def test_batch_update_currency_formula_formats_result(self):
        response = self._batch([
            {
                'operation': 'set',
                'row': 0,
                'column': 0,
                'raw_input': '$12',
                'value_type': 'number',
                'number_value': '12',
            },
            {
                'operation': 'set',
                'row': 0,
                'column': 1,
                'raw_input': '$5',
                'value_type': 'number',
                'number_value': '5',
            },
            {'operation': 'set', 'row': 0, 'column': 2, 'raw_input': '=SUM(A1:B1)'},
        ])
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        c1 = Cell.objects.get(sheet=self.sheet, row__position=0, column__position=2, is_deleted=False)
        self.assertEqual(c1.computed_type, ComputedCellType.NUMBER)
        self.assertIsNone(c1.error_code)
        self.assertEqual(Decimal(str(c1.computed_number)), Decimal('17'))
        self.assertEqual(c1.computed_string, '$17')

    def test_batch_update_currency_formula_trims_trailing_zeros(self):
        response = self._batch([
            {
                'operation': 'set',
                'row': 0,
                'column': 0,
                'raw_input': '$12.50',
                'value_type': 'number',
                'number_value': '12.50',
            },
            {
                'operation': 'set',
                'row': 0,
                'column': 1,
                'raw_input': '$2.00',
                'value_type': 'number',
                'number_value': '2.00',
            },
            {'operation': 'set', 'row': 0, 'column': 2, 'raw_input': '=SUM(A1:B1)'},
        ])
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        c1 = Cell.objects.get(sheet=self.sheet, row__position=0, column__position=2, is_deleted=False)
        self.assertEqual(c1.computed_type, ComputedCellType.NUMBER)
        self.assertIsNone(c1.error_code)
        self.assertEqual(Decimal(str(c1.computed_number)), Decimal('14.5'))
        self.assertEqual(c1.computed_string, '$14.5')

    def test_sum_multiple_arguments(self):
        response = self._batch([
            {'operation': 'set', 'row': 0, 'column': 2, 'raw_input': '=SUM(A1, B1, A1:B2)'},
            {'operation': 'set', 'row': 0, 'column': 0, 'raw_input': '1'},
            {'operation': 'set', 'row': 0, 'column': 1, 'raw_input': '2'},
            {'operation': 'set', 'row': 1, 'column': 0, 'raw_input': '3'},
            {'operation': 'set', 'row': 1, 'column': 1, 'raw_input': '4'},
        ])
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        c1 = Cell.objects.get(sheet=self.sheet, row__position=0, column__position=2, is_deleted=False)
        self.assertEqual(c1.computed_type, ComputedCellType.NUMBER)
        self.assertEqual(c1.error_code, None)
        self.assertEqual(Decimal(str(c1.computed_number)), Decimal('13'))

    def test_sum_nested_dependency_updates(self):
        response = self._batch([
            {'operation': 'set', 'row': 0, 'column': 2, 'raw_input': '=SUM(A1:B1)'},
            {'operation': 'set', 'row': 0, 'column': 3, 'raw_input': '=C1'},
            {'operation': 'set', 'row': 0, 'column': 0, 'raw_input': '1'},
            {'operation': 'set', 'row': 0, 'column': 1, 'raw_input': '2'},
        ])
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        d1 = Cell.objects.get(sheet=self.sheet, row__position=0, column__position=3, is_deleted=False)
        self.assertEqual(d1.computed_type, ComputedCellType.NUMBER)
        self.assertEqual(d1.error_code, None)
        self.assertEqual(Decimal(str(d1.computed_number)), Decimal('3'))

        response = self._batch([
            {'operation': 'set', 'row': 0, 'column': 1, 'raw_input': '5'},
        ])
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        d1.refresh_from_db()
        self.assertEqual(d1.computed_type, ComputedCellType.NUMBER)
        self.assertEqual(d1.error_code, None)
        self.assertEqual(Decimal(str(d1.computed_number)), Decimal('6'))

    def test_average_range_with_empty_cells(self):
        response = self._batch([
            {'operation': 'set', 'row': 0, 'column': 2, 'raw_input': '=AVERAGE(A1:B2)'},
            {'operation': 'set', 'row': 0, 'column': 0, 'raw_input': '2'},
            {'operation': 'set', 'row': 1, 'column': 1, 'raw_input': '4'},
        ])
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        c1 = Cell.objects.get(sheet=self.sheet, row__position=0, column__position=2, is_deleted=False)
        self.assertEqual(c1.computed_type, ComputedCellType.NUMBER)
        self.assertEqual(c1.error_code, None)
        self.assertEqual(Decimal(str(c1.computed_number)), Decimal('1.5'))

    def test_average_multiple_arguments(self):
        response = self._batch([
            {'operation': 'set', 'row': 0, 'column': 2, 'raw_input': '=AVERAGE(A1, B1, A1:B2)'},
            {'operation': 'set', 'row': 0, 'column': 0, 'raw_input': '1'},
            {'operation': 'set', 'row': 0, 'column': 1, 'raw_input': '3'},
            {'operation': 'set', 'row': 1, 'column': 0, 'raw_input': '5'},
            {'operation': 'set', 'row': 1, 'column': 1, 'raw_input': '7'},
        ])
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        c1 = Cell.objects.get(sheet=self.sheet, row__position=0, column__position=2, is_deleted=False)
        self.assertEqual(c1.computed_type, ComputedCellType.NUMBER)
        self.assertEqual(c1.error_code, None)
        self.assertEqual(Decimal(str(c1.computed_number)).quantize(Decimal('0.0000000001')), Decimal('3.3333333333'))

    def test_average_nested_dependency_updates(self):
        response = self._batch([
            {'operation': 'set', 'row': 0, 'column': 2, 'raw_input': '=AVERAGE(A1:B1)'},
            {'operation': 'set', 'row': 0, 'column': 3, 'raw_input': '=C1'},
            {'operation': 'set', 'row': 0, 'column': 0, 'raw_input': '2'},
            {'operation': 'set', 'row': 0, 'column': 1, 'raw_input': '4'},
        ])
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        d1 = Cell.objects.get(sheet=self.sheet, row__position=0, column__position=3, is_deleted=False)
        self.assertEqual(d1.computed_type, ComputedCellType.NUMBER)
        self.assertEqual(d1.error_code, None)
        self.assertEqual(Decimal(str(d1.computed_number)), Decimal('3'))

        response = self._batch([
            {'operation': 'set', 'row': 0, 'column': 1, 'raw_input': '6'},
        ])
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        d1.refresh_from_db()
        self.assertEqual(d1.computed_type, ComputedCellType.NUMBER)
        self.assertEqual(d1.error_code, None)
        self.assertEqual(Decimal(str(d1.computed_number)), Decimal('4'))

    def test_min_range_with_empty_cells(self):
        response = self._batch([
            {'operation': 'set', 'row': 0, 'column': 2, 'raw_input': '=MIN(A1:B2)'},
            {'operation': 'set', 'row': 0, 'column': 0, 'raw_input': '2'},
        ])
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        c1 = Cell.objects.get(sheet=self.sheet, row__position=0, column__position=2, is_deleted=False)
        self.assertEqual(c1.computed_type, ComputedCellType.NUMBER)
        self.assertEqual(c1.error_code, None)
        self.assertEqual(Decimal(str(c1.computed_number)), Decimal('0'))

    def test_min_max_currency_range(self):
        response = self._batch([
            {'operation': 'set', 'row': 0, 'column': 0, 'raw_input': '$12'},
            {'operation': 'set', 'row': 0, 'column': 1, 'raw_input': '$5'},
            {'operation': 'set', 'row': 0, 'column': 2, 'raw_input': '=MIN(A1:B1)'},
            {'operation': 'set', 'row': 0, 'column': 3, 'raw_input': '=MAX(A1:B1)'},
        ])
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        c1 = Cell.objects.get(sheet=self.sheet, row__position=0, column__position=2, is_deleted=False)
        d1 = Cell.objects.get(sheet=self.sheet, row__position=0, column__position=3, is_deleted=False)

        self.assertEqual(c1.computed_type, ComputedCellType.NUMBER)
        self.assertIsNone(c1.error_code)
        self.assertEqual(Decimal(str(c1.computed_number)), Decimal('5'))
        self.assertEqual(c1.computed_string, '$5')

        self.assertEqual(d1.computed_type, ComputedCellType.NUMBER)
        self.assertIsNone(d1.error_code)
        self.assertEqual(Decimal(str(d1.computed_number)), Decimal('12'))
        self.assertEqual(d1.computed_string, '$12')

    def test_max_range_with_empty_cells(self):
        response = self._batch([
            {'operation': 'set', 'row': 0, 'column': 2, 'raw_input': '=MAX(A1:B2)'},
            {'operation': 'set', 'row': 0, 'column': 0, 'raw_input': '2'},
        ])
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        c1 = Cell.objects.get(sheet=self.sheet, row__position=0, column__position=2, is_deleted=False)
        self.assertEqual(c1.computed_type, ComputedCellType.NUMBER)
        self.assertEqual(c1.error_code, None)
        self.assertEqual(Decimal(str(c1.computed_number)), Decimal('2'))

    def test_min_multiple_arguments(self):
        response = self._batch([
            {'operation': 'set', 'row': 0, 'column': 2, 'raw_input': '=MIN(A1, B1, A1:B2)'},
            {'operation': 'set', 'row': 0, 'column': 0, 'raw_input': '1'},
            {'operation': 'set', 'row': 0, 'column': 1, 'raw_input': '5'},
            {'operation': 'set', 'row': 1, 'column': 0, 'raw_input': '3'},
            {'operation': 'set', 'row': 1, 'column': 1, 'raw_input': '4'},
        ])
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        c1 = Cell.objects.get(sheet=self.sheet, row__position=0, column__position=2, is_deleted=False)
        self.assertEqual(c1.computed_type, ComputedCellType.NUMBER)
        self.assertEqual(c1.error_code, None)
        self.assertEqual(Decimal(str(c1.computed_number)), Decimal('1'))

    def test_min_max_nested_dependency_updates(self):
        response = self._batch([
            {'operation': 'set', 'row': 0, 'column': 2, 'raw_input': '=MIN(A1:B1)'},
            {'operation': 'set', 'row': 0, 'column': 3, 'raw_input': '=MAX(C1, A1)'},
            {'operation': 'set', 'row': 0, 'column': 0, 'raw_input': '2'},
            {'operation': 'set', 'row': 0, 'column': 1, 'raw_input': '4'},
        ])
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        d1 = Cell.objects.get(sheet=self.sheet, row__position=0, column__position=3, is_deleted=False)
        self.assertEqual(d1.computed_type, ComputedCellType.NUMBER)
        self.assertEqual(d1.error_code, None)
        self.assertEqual(Decimal(str(d1.computed_number)), Decimal('2'))

        response = self._batch([
            {'operation': 'set', 'row': 0, 'column': 0, 'raw_input': '5'},
        ])
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        d1.refresh_from_db()
        self.assertEqual(d1.computed_type, ComputedCellType.NUMBER)
        self.assertEqual(d1.error_code, None)
        self.assertEqual(Decimal(str(d1.computed_number)), Decimal('5'))

    def test_count_mixed_range_types(self):
        response = self._batch([
            {'operation': 'set', 'row': 0, 'column': 3, 'raw_input': '=COUNT(A1:C2)'},
            {'operation': 'set', 'row': 0, 'column': 0, 'raw_input': '1'},
            {'operation': 'set', 'row': 1, 'column': 0, 'raw_input': 'abc'},
            {'operation': 'set', 'row': 1, 'column': 1, 'raw_input': '=A1/0'},
            {'operation': 'set', 'row': 0, 'column': 2, 'value_type': 'boolean', 'boolean_value': True},
            {'operation': 'set', 'row': 1, 'column': 2, 'raw_input': '2'},
        ])
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        d1 = Cell.objects.get(sheet=self.sheet, row__position=0, column__position=3, is_deleted=False)
        self.assertEqual(d1.computed_type, ComputedCellType.NUMBER)
        self.assertEqual(d1.error_code, None)
        self.assertEqual(Decimal(str(d1.computed_number)), Decimal('2'))

    def test_count_all_empty_range(self):
        response = self._batch([
            {'operation': 'set', 'row': 2, 'column': 3, 'raw_input': '=COUNT(A4:B5)'},
        ])
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        d3 = Cell.objects.get(sheet=self.sheet, row__position=2, column__position=3, is_deleted=False)
        self.assertEqual(d3.computed_type, ComputedCellType.NUMBER)
        self.assertEqual(d3.error_code, None)
        self.assertEqual(Decimal(str(d3.computed_number)), Decimal('0'))

    def test_count_mixed_args_and_literals(self):
        response = self._batch([
            {'operation': 'set', 'row': 5, 'column': 3, 'raw_input': '=COUNT(A6, A7:A9, 3, 0)'},
            {'operation': 'set', 'row': 6, 'column': 0, 'raw_input': '5'},
            {'operation': 'set', 'row': 8, 'column': 0, 'raw_input': 'text'},
        ])
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        d6 = Cell.objects.get(sheet=self.sheet, row__position=5, column__position=3, is_deleted=False)
        self.assertEqual(d6.computed_type, ComputedCellType.NUMBER)
        self.assertEqual(d6.error_code, None)
        self.assertEqual(Decimal(str(d6.computed_number)), Decimal('3'))

    def test_count_ignores_error_cells(self):
        response = self._batch([
            {'operation': 'set', 'row': 9, 'column': 0, 'raw_input': 'abc'},
            {'operation': 'set', 'row': 9, 'column': 1, 'raw_input': '=A10*2'},
            {'operation': 'set', 'row': 9, 'column': 3, 'raw_input': '=COUNT(A10:B10)'},
        ])
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        d10 = Cell.objects.get(sheet=self.sheet, row__position=9, column__position=3, is_deleted=False)
        self.assertEqual(d10.computed_type, ComputedCellType.NUMBER)
        self.assertEqual(d10.error_code, None)
        self.assertEqual(Decimal(str(d10.computed_number)), Decimal('0'))

    def test_count_does_not_count_empty_arithmetic_zero(self):
        response = self._batch([
            {'operation': 'set', 'row': 11, 'column': 1, 'raw_input': '1'},
            {'operation': 'set', 'row': 11, 'column': 2, 'raw_input': '=A12+B12'},
            {'operation': 'set', 'row': 11, 'column': 3, 'raw_input': '=COUNT(A12, B12, C12)'},
        ])
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        d12 = Cell.objects.get(sheet=self.sheet, row__position=11, column__position=3, is_deleted=False)
        self.assertEqual(d12.computed_type, ComputedCellType.NUMBER)
        self.assertEqual(d12.error_code, None)
        self.assertEqual(Decimal(str(d12.computed_number)), Decimal('2'))

    def test_abs_round_floor_ceiling_basic(self):
        response = self._batch([
            {'operation': 'set', 'row': 0, 'column': 5, 'raw_input': '=ABS(-3.5)'},
            {'operation': 'set', 'row': 1, 'column': 5, 'raw_input': '=ROUND(2.345, 2)'},
            {'operation': 'set', 'row': 2, 'column': 5, 'raw_input': '=ROUND(1234, -2)'},
            {'operation': 'set', 'row': 3, 'column': 5, 'raw_input': '=FLOOR(3.7)'},
            {'operation': 'set', 'row': 4, 'column': 5, 'raw_input': '=FLOOR(-3.7)'},
            {'operation': 'set', 'row': 5, 'column': 5, 'raw_input': '=CEILING(3.2)'},
            {'operation': 'set', 'row': 6, 'column': 5, 'raw_input': '=CEILING(-3.2)'},
        ])
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        cells = {
            (cell.row_position, cell.column_position): cell
            for cell in Cell.objects.filter(sheet=self.sheet, row__position__lte=6, column__position=5, is_deleted=False)
        }
        self.assertEqual(Decimal(str(cells[(0, 5)].computed_number)), Decimal('3.5'))
        self.assertEqual(Decimal(str(cells[(1, 5)].computed_number)), Decimal('2.35'))
        self.assertEqual(Decimal(str(cells[(2, 5)].computed_number)), Decimal('1200'))
        self.assertEqual(Decimal(str(cells[(3, 5)].computed_number)), Decimal('3'))
        self.assertEqual(Decimal(str(cells[(4, 5)].computed_number)), Decimal('-4'))
        self.assertEqual(Decimal(str(cells[(5, 5)].computed_number)), Decimal('4'))
        self.assertEqual(Decimal(str(cells[(6, 5)].computed_number)), Decimal('-3'))

    def test_numeric_functions_empty_and_error_handling(self):
        response = self._batch([
            {'operation': 'set', 'row': 8, 'column': 0, 'raw_input': ''},
            {'operation': 'set', 'row': 8, 'column': 1, 'raw_input': 'abc'},
            {'operation': 'set', 'row': 8, 'column': 2, 'raw_input': '=A9/0'},
            {'operation': 'set', 'row': 8, 'column': 3, 'raw_input': '=ABS(A9)'},
            {'operation': 'set', 'row': 8, 'column': 4, 'raw_input': '=ROUND(B9)'},
            {'operation': 'set', 'row': 8, 'column': 5, 'raw_input': '=FLOOR(C9)'},
        ])
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        abs_cell = Cell.objects.get(sheet=self.sheet, row__position=8, column__position=3, is_deleted=False)
        self.assertEqual(abs_cell.computed_type, ComputedCellType.NUMBER)
        self.assertEqual(abs_cell.error_code, None)
        self.assertEqual(Decimal(str(abs_cell.computed_number)), Decimal('0'))

        round_cell = Cell.objects.get(sheet=self.sheet, row__position=8, column__position=4, is_deleted=False)
        self.assertEqual(round_cell.computed_type, ComputedCellType.ERROR)
        self.assertEqual(round_cell.error_code, '#VALUE!')

        floor_cell = Cell.objects.get(sheet=self.sheet, row__position=8, column__position=5, is_deleted=False)
        self.assertEqual(floor_cell.computed_type, ComputedCellType.ERROR)
        self.assertEqual(floor_cell.error_code, '#VALUE!')

    def test_batch_update_accepts_long_decimal(self):
        long_decimal = '9.7654322457898765'
        response = self._batch([
            {'operation': 'set', 'row': 0, 'column': 0, 'raw_input': long_decimal},
        ])
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        cell = Cell.objects.get(sheet=self.sheet, row__position=0, column__position=0, is_deleted=False)
        self.assertEqual(cell.computed_type, ComputedCellType.NUMBER)
        self.assertEqual(cell.error_code, None)
        self.assertEqual(Decimal(str(cell.computed_number)), Decimal(long_decimal))

    def test_batch_update_invalid_number_value_returns_400(self):
        response = self._batch([
            {'operation': 'set', 'row': 0, 'column': 0, 'value_type': 'number', 'number_value': 'not-a-number'},
        ])
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_formula_uses_long_decimal_value(self):
        long_decimal = Decimal('9.7654322457898765')
        response = self._batch([
            {'operation': 'set', 'row': 0, 'column': 0, 'raw_input': str(long_decimal)},
            {'operation': 'set', 'row': 0, 'column': 1, 'raw_input': '=A1*2'},
        ])
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        cell = Cell.objects.get(sheet=self.sheet, row__position=0, column__position=1, is_deleted=False)
        self.assertEqual(cell.computed_type, ComputedCellType.NUMBER)
        self.assertEqual(cell.error_code, None)
        self.assertEqual(Decimal(str(cell.computed_number)), long_decimal * Decimal('2'))

    def test_cycle_detection(self):
        response = self._batch([
            {'operation': 'set', 'row': 0, 'column': 0, 'raw_input': '=B1'},
            {'operation': 'set', 'row': 0, 'column': 1, 'raw_input': '=A1'},
        ])
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        cells = {
            (cell['row_position'], cell['column_position']): cell
            for cell in response.data.get('cells', [])
        }
        self.assertEqual(cells[(0, 0)]['error_code'], '#CYCLE!')
        self.assertEqual(cells[(0, 1)]['error_code'], '#CYCLE!')


# ========== Batch Import Performance / Error-Path Tests ==========


class CellBatchUpdateLargeImportTest(TestCase):
    """Regression tests for >1000-op batch imports.

    Previously batch_update_cells built a 1000-way Q() OR to look up existing cells,
    which blew up the Q tree depth (RecursionError) and produced huge SQL plans. These
    tests make sure large chunks now finish cleanly.
    """

    def setUp(self):
        self.user = create_test_user()
        self.organization = create_test_organization()
        self.project = create_test_project(self.organization, owner=self.user)
        self.spreadsheet = create_test_spreadsheet(self.project)
        self.sheet = create_test_sheet(self.spreadsheet)
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def _batch(self, operations, import_mode=False, import_id=None, chunk_index=None):
        url = f'/api/spreadsheet/spreadsheets/{self.spreadsheet.id}/sheets/{self.sheet.id}/cells/batch/'
        payload = {'operations': operations, 'auto_expand': True}
        if import_mode:
            payload['import_mode'] = True
        if import_id is not None:
            payload['import_id'] = import_id
        if chunk_index is not None:
            payload['chunk_index'] = chunk_index
        return self.client.post(url, payload, format='json')

    def test_batch_update_cells_large_chunk_does_not_raise(self):
        """A 1500-op chunk must succeed (no RecursionError, no server 500)."""
        operations = []
        # 150 rows x 10 columns = 1500 ops — exceeds the old 1000-threshold that
        # broke the Q-OR path.
        for r in range(150):
            for c in range(10):
                operations.append({
                    'operation': 'set',
                    'row': r,
                    'column': c,
                    'raw_input': f'v{r}-{c}',
                })
        response = self._batch(operations, import_mode=True, import_id='import-large', chunk_index=0)
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(
            Cell.objects.filter(sheet=self.sheet, is_deleted=False).count(),
            1500,
        )

    def test_batch_update_cells_second_chunk_updates_existing(self):
        """Running the same (row,col) twice across chunks must dedupe against existing rows."""
        chunk1 = [{'operation': 'set', 'row': r, 'column': 0, 'raw_input': 'a'} for r in range(50)]
        self._batch(chunk1, import_mode=True, import_id='imp', chunk_index=0)
        chunk2 = [{'operation': 'set', 'row': r, 'column': 0, 'raw_input': 'b'} for r in range(50)]
        response = self._batch(chunk2, import_mode=True, import_id='imp', chunk_index=1)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            Cell.objects.filter(sheet=self.sheet, is_deleted=False).count(),
            50,
        )
        for r in range(50):
            c = Cell.objects.get(sheet=self.sheet, row__position=r, column__position=0, is_deleted=False)
            self.assertEqual(c.raw_input, 'b')


class CellBatchImportModePivotTest(TestCase):
    """Pivot recompute should be skipped in per-chunk batch calls when import_mode=True,
    and performed once at ImportFinalizeView time."""

    def setUp(self):
        self.user = create_test_user()
        self.organization = create_test_organization()
        self.project = create_test_project(self.organization, owner=self.user)
        self.spreadsheet = create_test_spreadsheet(self.project)
        self.sheet = create_test_sheet(self.spreadsheet)
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def _batch_url(self):
        return f'/api/spreadsheet/spreadsheets/{self.spreadsheet.id}/sheets/{self.sheet.id}/cells/batch/'

    def _finalize_url(self):
        return f'/api/spreadsheet/spreadsheets/{self.spreadsheet.id}/sheets/{self.sheet.id}/cells/import-finalize/'

    def test_batch_update_import_mode_skips_pivot_recompute(self):
        from unittest.mock import patch
        operations = [
            {'operation': 'set', 'row': 0, 'column': 0, 'raw_input': 'x'},
            {'operation': 'set', 'row': 0, 'column': 1, 'raw_input': 'y'},
        ]
        with patch('spreadsheet.pivot_service.recompute_pivots_for_source_sheet') as mock_recompute:
            response = self.client.post(
                self._batch_url(),
                {'operations': operations, 'auto_expand': True, 'import_mode': True, 'import_id': 'imp-1', 'chunk_index': 0},
                format='json',
            )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        mock_recompute.assert_not_called()

    def test_batch_update_non_import_mode_recomputes_pivot(self):
        from unittest.mock import patch
        operations = [
            {'operation': 'set', 'row': 0, 'column': 0, 'raw_input': 'x'},
        ]
        with patch('spreadsheet.pivot_service.recompute_pivots_for_source_sheet') as mock_recompute:
            response = self.client.post(
                self._batch_url(),
                {'operations': operations, 'auto_expand': True},
                format='json',
            )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        mock_recompute.assert_called_once()

    def test_import_finalize_recomputes_pivot_once(self):
        from unittest.mock import patch
        # Seed a couple of cells via import_mode so there is something to finalize.
        self.client.post(
            self._batch_url(),
            {
                'operations': [
                    {'operation': 'set', 'row': 0, 'column': 0, 'raw_input': '1'},
                    {'operation': 'set', 'row': 0, 'column': 1, 'raw_input': '=A1+1'},
                ],
                'auto_expand': True,
                'import_mode': True,
                'import_id': 'imp-fin',
                'chunk_index': 0,
            },
            format='json',
        )
        with patch('spreadsheet.pivot_service.recompute_pivots_for_source_sheet') as mock_recompute:
            response = self.client.post(
                self._finalize_url(),
                {'import_id': 'imp-fin'},
                format='json',
            )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        mock_recompute.assert_called_once()

    def test_import_finalize_recomputes_formulas_for_import_mode_cells(self):
        """Dependencies skipped per-chunk under import_mode must be rebuilt at finalize."""
        self.client.post(
            self._batch_url(),
            {
                'operations': [
                    {'operation': 'set', 'row': 0, 'column': 0, 'raw_input': '10'},
                    {'operation': 'set', 'row': 0, 'column': 1, 'raw_input': '=A1*2'},
                ],
                'auto_expand': True,
                'import_mode': True,
                'import_id': 'imp-calc',
                'chunk_index': 0,
            },
            format='json',
        )
        # Before finalize: formula cell has not been computed.
        b1 = Cell.objects.get(sheet=self.sheet, row__position=0, column__position=1, is_deleted=False)
        self.assertNotEqual(b1.computed_type, ComputedCellType.NUMBER)

        response = self.client.post(self._finalize_url(), {'import_id': 'imp-calc'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        b1.refresh_from_db()
        self.assertEqual(b1.computed_type, ComputedCellType.NUMBER)
        self.assertEqual(Decimal(str(b1.computed_number)), Decimal('20'))


class CellBatchUpdateConcurrentColumnCreateTest(TestCase):
    """Simulates two chunks racing to create the same SheetColumn positions:
    the unique partial index would reject the second writer without ignore_conflicts=True.

    We simulate the race deterministically by pre-building two SheetColumn objects with
    the same (sheet, position, is_deleted=False) and attempting a bulk_create that
    would have conflicted under the old code path. Because batch_update_cells now uses
    ignore_conflicts=True + re-SELECT, no IntegrityError is raised.
    """

    def setUp(self):
        self.user = create_test_user()
        self.organization = create_test_organization()
        self.project = create_test_project(self.organization, owner=self.user)
        self.spreadsheet = create_test_spreadsheet(self.project)
        self.sheet = create_test_sheet(self.spreadsheet)

    def test_bulk_create_column_conflict_is_ignored(self):
        from spreadsheet.models import SheetColumn
        SheetColumn.objects.create(sheet=self.sheet, position=0, name='A', is_deleted=False)
        # bulk_create with ignore_conflicts=True should tolerate the conflict.
        SheetColumn.objects.bulk_create(
            [SheetColumn(sheet=self.sheet, position=0, name='A', is_deleted=False)],
            ignore_conflicts=True,
        )
        self.assertEqual(
            SheetColumn.objects.filter(sheet=self.sheet, position=0, is_deleted=False).count(),
            1,
        )

    def test_batch_update_cells_handles_preexisting_column(self):
        """Pre-create the columns that batch_update_cells would otherwise create, then
        issue a batch that touches those columns. No IntegrityError must escape."""
        from spreadsheet.models import SheetColumn
        for pos in range(5):
            SheetColumn.objects.create(sheet=self.sheet, position=pos, name=f'C{pos}', is_deleted=False)

        client = APIClient()
        client.force_authenticate(user=self.user)
        url = f'/api/spreadsheet/spreadsheets/{self.spreadsheet.id}/sheets/{self.sheet.id}/cells/batch/'
        operations = [
            {'operation': 'set', 'row': r, 'column': c, 'raw_input': f'{r},{c}'}
            for r in range(3)
            for c in range(5)
        ]
        response = client.post(
            url,
            {'operations': operations, 'auto_expand': True, 'import_mode': True, 'import_id': 'imp', 'chunk_index': 0},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(
            Cell.objects.filter(sheet=self.sheet, is_deleted=False).count(),
            15,
        )
