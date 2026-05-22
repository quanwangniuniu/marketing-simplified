from django.db import models


class EndReason(models.TextChoices):
    CLOSED = 'CLOSED', 'Closed'
    TIMEOUT = 'TIMEOUT', 'Timeout'
    INTERRUPTED = 'INTERRUPTED', 'Interrupted'


class EventType(models.TextChoices):
    TASK_OPEN = 'TASK_OPEN', 'Task Open'
    FIRST_INTERACTION = 'FIRST_INTERACTION', 'First Interaction'
    TASK_WRITE = 'TASK_WRITE', 'Task Write'
    IDLE_START = 'IDLE_START', 'Idle Start'
    IDLE_END = 'IDLE_END', 'Idle End'
