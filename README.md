# API

## Login & User Management
`/auth`
* Method: POST
* Params: username, password

`/profile`
* Method: GET
* Header: Authorization
* Eg: `Authorization: BEARER eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6ImFkbWluIiwiaWF0IjoxNTAzMzk4MzE0LCJleHAiOjE1MDM0MDE5MTR9.2vgHyeRVvxb1Mtbz36AT8h-_nl_isRr_NoCQt8A8oxY`

`/forget`
* Method: POST
* Params: username