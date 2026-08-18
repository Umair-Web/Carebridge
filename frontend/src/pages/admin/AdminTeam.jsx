import TeamManagement from '../../components/TeamManagement';

const AdminTeam = () => (
  <TeamManagement
    endpoint="/admin/admins"
    title="Admin Team"
    subtitle="Add or remove platform administrators. Every admin has full access."
    memberNoun="admin"
  />
);

export default AdminTeam;
