[ HTTP Request ]
       |
       v
+------------------+
| EmployeeController|
+------------------+
       |
       v
+------------------+
| EmployeeService  |
+------------------+
       |
       v
+--------------------------+
| IEmployeeRepository      | <-- service depends on this
+--------------------------+
       |
       v
+--------------------------+
| EmployeeRepository       | <-- implements interface
+--------------------------+
       |
       v
+--------------------------+
| EmployeeModel (Mongoose) |
+--------------------------+
       |
       v
   MongoDB
