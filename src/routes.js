import Knex from './knex'
import jwt from 'jsonwebtoken'
var moment = require('moment')
const config = require('./config')
const bcrypt = require('bcrypt')
var generator = require('generate-password')
var fs = require('fs')
var excelToJson = require('convert-excel-to-json')

const routes = [
  /* USERS */
  // authentication
  {
    path: '/auth',
    method: 'POST',
    handler: (request, reply) => {
      const { username, password } = request.payload
      Knex('users').where({username}).select('password', 'name', 'email', 'mobile').then(([user]) => {
        if (!user) {
          reply({
            error: true,
            errMessage: 'the specified user was not found'
          })
          return
        }

        bcrypt.compare(password, user.password, function (err, res) {
          if (err) {
            reply({success: false, error: 'Password verify failed'})
          }
          if (res) {
            const token = jwt.sign(
              {username}, 'vZiYpmTzqXMp8PpYXKwqc9ShQ1UhyAfy', {
                algorithm: 'HS256',
                expiresIn: '24h'
              })

            reply({
              success: 'true',
              token: token,
              name: user.name,
              email: user.email,
              mobile: user.mobile
            })
          } else {
            reply({success: false, error: 'incorrect password'})
          }
        })
      }).catch((err) => {
        reply('server-side error' + err)
      })
    }
  },

  // Forget Password
  {
    path: '/forget',
    method: 'POST',
    handler: (request, reply) => {
      const { username } = request.payload
      Knex('users').where({username}).then(([user]) => {
        if (!user) {
          reply({
            success: false,
            message: `Specified user doesn't exist`
          })
          return
        }

        let newPassword = generator.generate({
          length: 5,
          numbers: false
        })

        bcrypt.hash(newPassword, 10, function (err, hash) {
          if (err) {
            reply({success: false, error: 'Password hashing failed, please contact Administrator'})
          }
          if (hash) {
            Knex('users')
              .where('username', '=', username)
              .update({
                password: hash
              }).then(count => {
              if (count) {
                const to = user.mobile
                const msg = 'Your new password at Mitsuba is ' + newPassword

                // send sms
                if (to && msg) {
                  var request = require('request')
                  const url = 'http://login.smsmoon.com/API/sms.php'
                  const body = {
                    'username': 'raghuedu',
                    'password': 'abcd.1234',
                    'from': 'RAGHUT',
                    'to': to,
                    'msg': msg,
                    'type': '1',
                    'dnd_check': '0'
                  }

                  request.post(url, {
                    form: body
                  }, function (error, response, body) {
                    if (!error && response.statusCode == 200) {
                      console.log(body) // Print the google web page.

                      reply({
                        success: true,
                        message: 'Password update successful' + hash
                      })
                    } else {
                      reply({
                        success: false,
                        message: 'Password update successful, but sending SMS failed. Contact Administrator'
                      })
                    }
                  })
                }
              } else {
                reply({
                  success: false,
                  message: 'Password update failed'
                })
              }
            })
          } else {
            // no hash generated
            reply('No hash generated, please contact administrator')
          }
        })
      }).catch((err) => {
        reply('server-side error' + err)
      })
    }
  },

  // Profile
  {
    path: '/profile',
    method: 'GET',
    config: {
      auth: {
        strategy: 'token'
      }
    },
    handler: (request, reply) => {
      let data = {username: request.auth.credentials.username}
      Knex('users').select('username', 'name', 'mobile', 'email').where(data).then((results) => {
        if (!results || results.length === 0) {
          reply({
            error: true,
            errMessage: 'no users found'
          })
        }

        reply({
          success: true,
          data: results
        })
      }).catch((err) => {
        reply('server-side error' + err)
      })
    }
  },

  // Change Profile
  {
    path: '/update_profile',
    method: 'POST',
    config: {
      auth: {
        strategy: 'token'
      }
    },
    handler: (request, reply) => {
      const { name, email, mobile, new_password, old_password } = request.payload
      let username = request.auth.credentials.username

      Knex('users').select('password').where({username}).then(([user]) => {
        if (!user) {
          reply({
            success: false,
            message: `Specified user doesn't exist`
          })
          return
        }

        if ((old_password || new_password) && !(old_password && new_password)) {
          reply({
            success: false,
            message: `Both Current Password and New Password are required`
          })
          return
        }

        if (old_password && new_password) {
          if (!bcrypt.compareSync(old_password, user.password)) {
            reply({
              success: false,
              message: `Incorrect Password`
            })
            return
          }
        }

        let data = {}
        if (name) {
          data['name'] = name
        }
        if (email) {
          data['email'] = email
        }
        if (mobile) {
          data['mobile'] = mobile
        }
        if (new_password) {
          data['password'] = bcrypt.hashSync(new_password, 10)
        }

        Knex('users')
          .where('username', '=', username)
          .update(data).then(count => {
          if (count) {
            reply({
              success: true,
              message: 'Profile update successful'
            })
          } else {
            reply({
              success: false,
              message: 'Password update failed'
            })
          }
        })
      }).catch((err) => {
        reply('server-side error' + err)
      })
    }
  },

  /* Roster */
  {
    path: '/upload_schedule',
    method: 'POST',
    config: {
      auth: {
        strategy: 'token'
      },
      payload: {
        output: 'stream',
        parse: true,
        allow: 'multipart/form-data'
      },

      handler: function (request, reply) {
        var data = request.payload
        if (data.file) {
          var name = data.file.hapi.filename
          var path = config.UPLOAD_FOLDER + name
          var currentTime = moment().format('YYYYMMDDHHmmss')
          var newPath = path + '-' + currentTime

          var file = fs.createWriteStream(newPath)

          file.on('error', function (err) {
            console.error(err)
          })

          data.file.pipe(file)

          data.file.on('end', function (err) {
            if (err) {
              reply({
                success: false,
                message: 'File upload failed'
              })
            }

            // var ret = {
            //   filename: data.file.hapi.filename,
            //   headers: data.file.hapi.headers
            // }

            // prepare data to be inserted into db
            let result = excelToJson({
              sourceFile: newPath
            })

            if (!result) {
              reply({
                success: false,
                message: 'Cannot read excel file'
              })
            }

            var shifts = []
            var dept = ''
            result.Sheet1.forEach(row => {
              // proceed only if first column is a number, i.e. employee code
              if (!isNaN(row.A)) {
                if (row.E) {
                  dept = row.E
                }

                if (row.A && row.B && row.C && row.D && dept && row.C.toString().indexOf('-') !== -1 && row.D.toString().indexOf('-') !== -1) {
                  shifts.push({
                    emp_code: row.A.toString().trim(),
                    shift: row.B.toString().trim(),
                    shift_from: row.C.toString().trim(),
                    shift_to: row.D.toString().trim(),
                    dept: dept.toString().trim()
                  })
                }
              }
            })

            if (shifts.length) {
              insertOrUpdate(Knex, 'shifts', shifts).then((res) => {
                reply({
                  success: true
                })
              }).catch((err) => {
                reply({
                  success: false,
                  error: err.message
                })
              })
            } else {
              reply({
                success: false,
                error: 'No data imported, please check if the file is in correct format'
              })
            }
          })
        } else {
          reply({
            success: false,
            message: 'No data'
          })
        }
      }
    }
  },

  // Shift Schedule
  {
    path: '/shift_schedule',
    method: 'POST',
    config: {
      auth: {
        strategy: 'token'
      }
    },
    handler: (request, reply) => {
      const { date } = request.payload

      if (!date) {
        return reply({
          success: false,
          message: 'Date is a mandatory parameter'
        })
      }

      let query = Knex.raw(`select emp_code, shift, shift_from, shift_to, dept from shifts where shift_from <= '${date}' and shift_to >= '${date}' order by emp_code`)

      console.log(query)

      query.then((results) => {
        if (!results || results[0].length === 0) {
          reply({
            success: false,
            errMessage: 'no data found'
          })
        } else {
          reply({
            success: true,
            dataCount: results[0].length,
            data: results[0]
          })
        }
      }).catch((err) => {
        reply('server-side error' + err)
      })
    }
  },

  /* Admin */
  // Insert data
  {
    path: '/insertdata',
    method: 'GET',
    config: {
      handler: (request, reply) => {
        var params = request.query
        var emp_code = params.emp_code
        var time = params.time

        if (!emp_code || !time) {
          reply({
            success: false,
            error: 'Please send both emp_code and time'
          })
        } else {
          Knex('data').insert({emp_code, time}).then(function (result) {
            reply({ success: true, message: result }) // respond back to request
          })
        }
      }
    }
  }

]

function insertOrUpdate (knex, tableName, data) {
  const firstData = data[0] ? data[0] : data
  return knex.raw(knex(tableName).insert(data).toQuery() + ' ON DUPLICATE KEY UPDATE ' +
    Object.getOwnPropertyNames(firstData).map((field) => `${field}=VALUES(${field})`).join(', '))
}

export default routes
