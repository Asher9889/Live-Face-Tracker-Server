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




# Minio Steup

- Command to run minio: `server C:\minio\data --address :9000 --console-address :9001`
