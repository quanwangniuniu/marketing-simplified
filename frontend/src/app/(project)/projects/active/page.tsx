import ProjectsPage from '@/components/projects/ProjectsPage';

const ActiveProjectsPage = () => (
  <ProjectsPage
    title="Active Projects"
    description="Projects currently marked as active for your account."
    filter="active"
  />
);

export default ActiveProjectsPage;
