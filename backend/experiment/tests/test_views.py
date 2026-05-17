"""
Test cases for experiment API views
"""
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status
from datetime import timedelta

from experiment.models import Experiment, ExperimentProgressUpdate
from task.models import Task
from core.models import Organization, Project, ProjectMember

User = get_user_model()


class ExperimentListCreateViewTest(TestCase):
    """Test cases for experiment list/create API view"""
    
    def setUp(self):
        """Set up test data"""
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        
        self.other_user = User.objects.create_user(
            username='otheruser',
            email='other@example.com',
            password='testpass123'
        )
        
        self.organization = Organization.objects.create(name="Test Organization")
        self.project = Project.objects.create(
            name="Test Project",
            organization=self.organization
        )
        
        ProjectMember.objects.create(
            user=self.user,
            project=self.project,
            role='Team Leader',
            is_active=True
        )
        
        self.task = Task.objects.create(
            summary='Test Experiment Task',
            type='experiment',
            project=self.project,
            owner=self.user,
            start_date=timezone.now().date(),
            due_date=(timezone.now() + timedelta(days=30)).date()
        )
        
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        
        self.experiment_data = {
            'name': 'Test A/B Campaign',
            'hypothesis': 'New video creative increases CTR by 10%',
            'expected_outcome': '10% increase in CTR',
            'description': 'Testing new video creative',
            'control_group': {'campaigns': ['fb:123456']},
            'variant_group': {'campaigns': ['fb:789012']},
            'success_metric': 'CTR',
            'constraints': 'Budget constraint',
            'task': self.task.id,
        }
    
    def test_create_experiment_success(self):
        """Test successful experiment creation"""
        response = self.client.post('/api/experiment/experiments/', self.experiment_data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['name'], self.experiment_data['name'])
        self.assertEqual(response.data['hypothesis'], self.experiment_data['hypothesis'])
        self.assertEqual(response.data['status'], Experiment.ExperimentStatus.DRAFT)
        self.assertEqual(response.data['created_by'], self.user.get_full_name().strip() or self.user.username or self.user.email)
        
        # Verify experiment was created in database
        experiment = Experiment.objects.get(id=response.data['id'])
        self.assertEqual(experiment.task, self.task)
    
    def test_create_experiment_invalid_date_range(self):
        """Test experiment creation with invalid date range (dates now come from Task)"""
        # Create task with invalid date range (due_date before start_date)
        invalid_task = Task.objects.create(
            summary='Invalid Date Task',
            type='experiment',
            project=self.project,
            owner=self.user,
            start_date=timezone.now().date(),
            due_date=timezone.now().date() - timedelta(days=1)  # Before start_date
        )
        
        invalid_data = self.experiment_data.copy()
        invalid_data['task'] = invalid_task.id
        
        response = self.client.post('/api/experiment/experiments/', invalid_data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('detail', response.data)
        self.assertIn('task', response.data['detail'])
    
    def test_create_experiment_invalid_task_type(self):
        """Test experiment creation with wrong task type"""
        wrong_task = Task.objects.create(
            summary='Wrong Task',
            type='asset',  # Wrong type
            project=self.project,
            owner=self.user
        )
        
        invalid_data = self.experiment_data.copy()
        invalid_data['task'] = wrong_task.id
        
        response = self.client.post('/api/experiment/experiments/', invalid_data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('detail', response.data)
        self.assertIn('task', response.data['detail'])
    
    def test_create_experiment_duplicate_task(self):
        """Test that only one experiment can be linked to a task"""
        # Create first experiment
        Experiment.objects.create(
            name='First Experiment',
            hypothesis='Test hypothesis',
            task=self.task,
            created_by=self.user
        )
        
        # Try to create second experiment with same task
        response = self.client.post('/api/experiment/experiments/', self.experiment_data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('detail', response.data)
        self.assertIn('task', response.data['detail'])
    
    def test_list_experiments(self):
        """Test listing experiments"""
        # Create some experiments
        experiment1 = Experiment.objects.create(
            name='Experiment 1',
            hypothesis='Test hypothesis 1',
            task=self.task,
            created_by=self.user
        )
        
        task2 = Task.objects.create(
            summary='Another Task',
            type='experiment',
            project=self.project,
            owner=self.user,
            start_date=timezone.now().date(),
            due_date=(timezone.now() + timedelta(days=30)).date()
        )
        
        experiment2 = Experiment.objects.create(
            name='Experiment 2',
            hypothesis='Test hypothesis 2',
            task=task2,
            created_by=self.user
        )
        
        response = self.client.get('/api/experiment/experiments/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results'] if 'results' in response.data else response.data), 2)
    
    def test_list_experiments_filter_by_status(self):
        """Test filtering experiments by status"""
        experiment1 = Experiment.objects.create(
            name='Running Experiment',
            hypothesis='Test hypothesis',
            status=Experiment.ExperimentStatus.RUNNING,
            task=self.task,
            created_by=self.user
        )
        
        task2 = Task.objects.create(
            summary='Another Task',
            type='experiment',
            project=self.project,
            owner=self.user,
            start_date=timezone.now().date(),
            due_date=(timezone.now() + timedelta(days=30)).date()
        )
        
        experiment2 = Experiment.objects.create(
            name='Draft Experiment',
            hypothesis='Test hypothesis',
            status=Experiment.ExperimentStatus.DRAFT,
            task=task2,
            created_by=self.user
        )
        
        response = self.client.get('/api/experiment/experiments/?status=running')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data['results'] if 'results' in response.data else response.data
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['status'], Experiment.ExperimentStatus.RUNNING)
    
    def test_create_experiment_missing_required_fields(self):
        """Test experiment creation with missing required fields"""
        invalid_data = {'name': 'Test'}  # Missing required fields
        
        response = self.client.post('/api/experiment/experiments/', invalid_data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
    
    def test_create_experiment_unauthorized(self):
        """Test that unauthenticated users cannot create experiments"""
        self.client.force_authenticate(user=None)
        
        response = self.client.post('/api/experiment/experiments/', self.experiment_data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class ExperimentRetrieveUpdateViewTest(TestCase):
    """Test cases for experiment retrieve/update API view"""
    
    def setUp(self):
        """Set up test data"""
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        
        self.organization = Organization.objects.create(name="Test Organization")
        self.project = Project.objects.create(
            name="Test Project",
            organization=self.organization
        )
        
        ProjectMember.objects.create(
            user=self.user,
            project=self.project,
            role='Team Leader',
            is_active=True
        )
        
        self.task = Task.objects.create(
            summary='Test Experiment Task',
            type='experiment',
            project=self.project,
            owner=self.user,
            start_date=timezone.now().date(),
            due_date=(timezone.now() + timedelta(days=30)).date()
        )
        
        self.experiment = Experiment.objects.create(
            name='Test Experiment',
            hypothesis='Test hypothesis',
            status=Experiment.ExperimentStatus.DRAFT,
            task=self.task,
            created_by=self.user
        )
        
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
    
    def test_retrieve_experiment(self):
        """Test retrieving an experiment"""
        response = self.client.get(f'/api/experiment/experiments/{self.experiment.id}/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['id'], self.experiment.id)
        self.assertEqual(response.data['name'], self.experiment.name)
    
    def test_update_experiment(self):
        """Test updating an experiment"""
        update_data = {
            'name': 'Updated Experiment Name',
            'expected_outcome': '15% increase in CTR'
        }
        
        response = self.client.patch(
            f'/api/experiment/experiments/{self.experiment.id}/',
            update_data,
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['name'], 'Updated Experiment Name')
        self.assertEqual(response.data['expected_outcome'], '15% increase in CTR')
        
        self.experiment.refresh_from_db()
        self.assertEqual(self.experiment.name, 'Updated Experiment Name')
    
    def test_update_experiment_status_transition(self):
        """Test updating experiment status with valid transition"""
        update_data = {
            'status': Experiment.ExperimentStatus.RUNNING
        }
        
        response = self.client.patch(
            f'/api/experiment/experiments/{self.experiment.id}/',
            update_data,
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.experiment.refresh_from_db()
        self.assertEqual(self.experiment.status, Experiment.ExperimentStatus.RUNNING)
    
    def test_update_experiment_invalid_status_transition(self):
        """Test updating experiment status with invalid transition"""
        self.experiment.status = Experiment.ExperimentStatus.COMPLETED
        self.experiment.save()
        
        update_data = {
            'status': Experiment.ExperimentStatus.RUNNING
        }
        
        response = self.client.patch(
            f'/api/experiment/experiments/{self.experiment.id}/',
            update_data,
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('detail', response.data)
        self.assertIn('status', response.data['detail'])
    
    def test_update_experiment_auto_set_started_at(self):
        """Test that started_at is automatically set when status changes to RUNNING"""
        update_data = {
            'status': Experiment.ExperimentStatus.RUNNING
        }
        
        response = self.client.patch(
            f'/api/experiment/experiments/{self.experiment.id}/',
            update_data,
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.experiment.refresh_from_db()
        self.assertEqual(self.experiment.status, Experiment.ExperimentStatus.RUNNING)
        self.assertIsNotNone(self.experiment.started_at)
    
    def test_update_experiment_set_outcome_when_completed(self):
        """Test setting outcome when experiment is completed"""
        self.experiment.status = Experiment.ExperimentStatus.COMPLETED
        self.experiment.save()
        
        update_data = {
            'experiment_outcome': Experiment.ExperimentOutcome.WIN,
            'outcome_notes': 'Experiment was successful'
        }
        
        response = self.client.patch(
            f'/api/experiment/experiments/{self.experiment.id}/',
            update_data,
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.experiment.refresh_from_db()
        self.assertEqual(self.experiment.experiment_outcome, Experiment.ExperimentOutcome.WIN)
        self.assertEqual(self.experiment.outcome_notes, 'Experiment was successful')
    
    def test_update_experiment_set_outcome_when_not_completed(self):
        """Test that outcome cannot be set when status is not completed"""
        self.experiment.status = Experiment.ExperimentStatus.RUNNING
        self.experiment.save()
        
        update_data = {
            'experiment_outcome': Experiment.ExperimentOutcome.WIN
        }
        
        response = self.client.patch(
            f'/api/experiment/experiments/{self.experiment.id}/',
            update_data,
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('detail', response.data)
        self.assertIn('experiment_outcome', response.data['detail'])


class ExperimentProgressUpdateListCreateViewTest(TestCase):
    """Test cases for experiment progress updates API view"""
    
    def setUp(self):
        """Set up test data"""
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        
        self.organization = Organization.objects.create(name="Test Organization")
        self.project = Project.objects.create(
            name="Test Project",
            organization=self.organization
        )
        
        ProjectMember.objects.create(
            user=self.user,
            project=self.project,
            role='Team Leader',
            is_active=True
        )
        
        self.task = Task.objects.create(
            summary='Test Experiment Task',
            type='experiment',
            project=self.project,
            owner=self.user,
            start_date=timezone.now().date(),
            due_date=(timezone.now() + timedelta(days=30)).date()
        )
        
        self.experiment = Experiment.objects.create(
            name='Test Experiment',
            hypothesis='Test hypothesis',
            status=Experiment.ExperimentStatus.RUNNING,
            task=self.task,
            created_by=self.user
        )
        
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
    
    def test_list_progress_updates(self):
        """Test listing progress updates for an experiment"""
        # Create some progress updates
        update1 = ExperimentProgressUpdate.objects.create(
            experiment=self.experiment,
            notes='Update 1',
            created_by=self.user
        )
        
        update2 = ExperimentProgressUpdate.objects.create(
            experiment=self.experiment,
            notes='Update 2',
            created_by=self.user
        )
        
        response = self.client.get(f'/api/experiment/experiments/{self.experiment.id}/progress-updates/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data['results'] if 'results' in response.data else response.data
        self.assertEqual(len(results), 2)
    
    def test_create_progress_update(self):
        """Test creating a progress update"""
        update_data = {
            'notes': 'Initial setup completed, campaigns launched successfully'
        }
        
        response = self.client.post(
            f'/api/experiment/experiments/{self.experiment.id}/progress-updates/',
            update_data,
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['notes'], update_data['notes'])
        self.assertEqual(response.data['created_by'], self.user.id)
        
        # Verify update was created
        update = ExperimentProgressUpdate.objects.get(id=response.data['id'])
        self.assertEqual(update.experiment, self.experiment)
        self.assertEqual(update.created_by, self.user)
    
    def test_create_progress_update_nonexistent_experiment(self):
        """Test creating progress update for non-existent experiment"""
        update_data = {
            'notes': 'Test update'
        }
        
        response = self.client.post(
            '/api/experiment/experiments/99999/progress-updates/',
            update_data,
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('detail', response.data)
    
    def test_create_progress_update_unauthorized(self):
        """Test that unauthenticated users cannot create progress updates"""
        self.client.force_authenticate(user=None)
        
        update_data = {
            'notes': 'Test update'
        }
        
        response = self.client.post(
            f'/api/experiment/experiments/{self.experiment.id}/progress-updates/',
            update_data,
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

