import ProjectsPage from '@/components/projects/ProjectsPage';

const CompletedProjectsPage = () => (
  <ProjectsPage
    title="Completed Projects"
    description="Archived or completed projects will appear here once the backend marks them as finished."
    filter="completed"
  />
);

export default CompletedProjectsPage;
