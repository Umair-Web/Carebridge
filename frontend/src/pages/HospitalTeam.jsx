import TeamManagement from '../components/TeamManagement';

const HospitalTeam = () => (
  <TeamManagement
    endpoint="/hospitals/users"
    title="Hospital Team"
    subtitle="Give your staff their own logins to this hospital portal."
    memberNoun="team member"
  />
);

export default HospitalTeam;
