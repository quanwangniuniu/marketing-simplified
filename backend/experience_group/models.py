from django.db import models                                                                                                                                       
from django.contrib.auth import get_user_model
from django_fsm import FSMField, transition                                                                                                                        
                                                                                                                                                                 
User = get_user_model()                                                                                                                                            
                                                                                                                                                                 
                                                                                                                                                                   
class ExperienceGroup(models.Model):
                                                                                                                                                                   
    class PublishStatus(models.TextChoices):                                                                                                                     
        DRAFT = 'DRAFT', 'Draft'        
        PUBLISHED = 'PUBLISHED', 'Published'
    project = models.ForeignKey(                                                                                                                                  
      'core.Project',                                                                                                                                        
      on_delete=models.CASCADE,
      related_name='experience_groups',  
      null=True,
      blank=True,
  )                                                                                                                                                               
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True, default='')                                                                                                         
                                                                                                                                                                 
    status = FSMField(                                                                                                                                             
        max_length=20,
        choices=PublishStatus.choices,                                                                                                                             
        default=PublishStatus.DRAFT,                                                                                                                             
        protected=True,
    )                                                                                                                                                              

                                                                                               
    draft_snapshot = models.JSONField(null=True, blank=True)
                                                                                                                                                                                                            
                                                                                                                                                                   
    created_by = models.ForeignKey(                                                                                                                                
        User,                                                                                                                                                      
        on_delete=models.SET_NULL,                                                                                                                                 
        null=True,                                                                                                                                                 
        related_name='created_experience_groups',                                                                                                                  
    )                                                                                                                                                              
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)                                                                                                               
    published_at = models.DateTimeField(null=True, blank=True)                                                                                                   
    class Meta:
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(
                fields=['project', 'name'],
                name='experience_group_unique_name_per_project',
            ),
        ]      
                                                                                                                                                                   
    def __str__(self):                                                                                                                                             
        return f"ExperienceGroup '{self.name}' ({self.status})"
                                                                                                                                                                   
    # --- FSM Transitions ---

    @transition(field=status, source=PublishStatus.DRAFT, target=PublishStatus.PUBLISHED)
    def publish(self):
        """
        Publish: Applies the draft snapshot's content to the main field, then clears the snapshot.
        The snapshot merging logic is handled by the View layer before this method is called.
        """
        from django.utils import timezone
        self.published_at = timezone.now()
        self.draft_snapshot = None

    @transition(field=status, source=PublishStatus.PUBLISHED, target=PublishStatus.DRAFT)
    def revert_to_draft(self):
        """
        Called automatically when a published group is edited.
        Moves the group back to DRAFT so it must be re-published to go live.
        """
        pass