const Departments = [ "Engineering", "HR", "Marketing", "Sales", "Admin", "Operations"] as const;
const Roles = [ "Admin", "Manager", "Employee", "Intern",] as const;

type TDepartment = typeof Departments[number];
type TRole = typeof Roles[number];

export { Departments, Roles, type TDepartment, type TRole };
