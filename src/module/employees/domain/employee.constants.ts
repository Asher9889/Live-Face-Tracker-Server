const Departments = [ "Engineering", "HR", "Marketing", "Sales", "Admin", "Operations"] as const;
const Roles = [ "Admin", "Manager", "Employee", "Intern",] as const;
const AllowedPoses = ["left", "left_mid", "frontal", "right_mid", "right"];

type TDepartment = typeof Departments[number];
type TRole = typeof Roles[number];
type TAllowedPose = typeof AllowedPoses[number];

export { Departments, Roles, AllowedPoses, type TDepartment, type TRole, type TAllowedPose };
    