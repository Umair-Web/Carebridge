import TeamManagement from '../../components/TeamManagement';

const LabTeam = () => (
  <TeamManagement
    endpoint="/labs/users"
    title="Laboratory Team"
    subtitle="Give your staff their own logins to this laboratory portal."
    memberNoun="team member"
  />
);

export default LabTeam;
