import Knex from './knex'
import jwt from 'jsonwebtoken'
var moment = require('moment')
const config = require('./config')
const bcrypt = require('bcrypt')
var generator = require('generate-password')
var fs = require('fs')
var excelToJson = require('convert-excel-to-json')
const nodemailer = require('nodemailer')
var _ = require('underscore-node')

const routes = [

  /* USERS */
  // authentication
  {
    path: '/auth',
    method: 'POST',
    handler: (request, reply) => {
      const { username, password } = request.payload
      Knex('users').where({
        username}).select('password', 'name', 'email', 'mobile').then(([user]) => {
          if (!user) {
            reply({
              error: true,
              errMessage: 'The specified user was not found'
            })
            return
          }

          bcrypt.compare(password, user.password, function (err, res) {
            if (err) {
              reply({ success: false, error: 'Password verify failed' })
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
              reply({ success: false, error: 'incorrect password' })
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
            reply({
              success: false,
              error: 'Password hashing failed, please contact Administrator'
            })
          }
          if (hash) {
            Knex('users')
              .where('username', '=', username)
              .update({
                password: hash
              }).then((count) => {
                if (count) {
                  const to = user.mobile
                  const msg = 'Your new password at Mitsuba is ' + newPassword

                // send sms
                  if (to && msg) {
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
                    var request3 = require('request')
                    request3.post(url, {
                      form: body
                    }, function (error, response, body) {
                      if (!error && parseInt(response.statusCode) === 200) {
                      // console.log(body) // Print the google web page.

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
      let data = { username: request.auth.credentials.username }
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
      const { name, email, mobile, new_password: newPassword, old_password: oldPassword } = request.payload

      let username = request.auth.credentials.username

      Knex('users').select('password').where({username}).then(([user]) => {
        if (!user) {
          reply({
            success: false,
            message: `Specified user doesn't exist`
          })
          return
        }

        if ((oldPassword || newPassword) && !(oldPassword && newPassword)) {
          reply({
            success: false,
            message: `Both Current Password and New Password are required`
          })
          return
        }

        if (oldPassword && newPassword) {
          if (!bcrypt.compareSync(oldPassword, user.password)) {
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
        if (newPassword) {
          data['password'] = bcrypt.hashSync(newPassword, 10)
        }

        Knex('users')
          .where({username: username})
          .update(data).then((count) => {
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
            // var dept = ''
            result.Sheet1.forEach((row) => {
              // proceed only if first column is a number, i.e. employee code
              if (!isNaN(row.A)) {
                // if (row.C) {
                //   dept = row.C
                // }

                if (row.A && row.B && row.C && row.D && row.E && row.F && row.G && row.H && row.G.toString().indexOf('-') !== -1 && row.H.toString().indexOf('-') !== -1) {
                  shifts.push({
                    emp_code: row.A.toString().trim(),
                    name: row.B.toString().trim(),
                    dept: row.C.toString().trim(),
                    designation: row.D.toString().trim(),
                    emp_type: row.E.toString().trim(),
                    shift: row.F.toString().trim(),
                    shift_from: row.G.toString().trim(),
                    shift_to: row.H.toString().trim()
                  })
                }
              }
            })

            console.log(shifts.length)

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
              console.log('not here')
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
        reply({
          success: false,
          message: 'Date is a mandatory parameter'
        })
      }

      let query = Knex.raw(`select emp_code, name, designation, emp_type, shift, shift_from, shift_to, dept from shifts where shift_from <= '${date}' and shift_to >= '${date}' order by emp_code`)

      // console.log(query)

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

  /* Dashboard - status */
  {
    path: '/status',
    method: 'GET',
    handler: (request, reply) => {
      var params = request.query
      var tm = params.tm
      var to = params.to
      var query

      // used for sms
      if (tm) {
        console.log('in sms', tm)

        var today = moment().format('YYYY-MM-DD')
        tm = today + ' ' + tm
        var tm6 = today + ' 06:00:00'
        var tm830 = today + ' 08:30:00'
        var tm14 = today + ' 14:00:00'
        var tm1730 = today + ' 17:30:00'
        var tm18 = today + ' 18:00:00'
        var tm22 = today + ' 22:00:00'
        var tm2 = today + ' 02:00:00'

        var smsquery = `SELECT shifts.shift, count(data.emp_code) as present, if(shifts.shift = 'A' and time_to_sec('${tm}') >=  time_to_sec('${tm6}') and time_to_sec('${tm}') <=  time_to_sec('${tm14}'),(select count(*) from shifts where shift='A' and shift_from <= current_date and shift_to >= current_date group by shift limit 1), if(shifts.shift = 'G' and time_to_sec('${tm}') >=  time_to_sec('${tm830}') and time_to_sec('${tm}') <=  time_to_sec('${tm1730}'),(select count(*) from shifts where shift='G' and shift_from <= current_date and shift_to >= current_date group by shift limit 1), if(shifts.shift = 'B' and time_to_sec('${tm}') >=  time_to_sec('${tm14}') and time_to_sec('${tm}') <=  time_to_sec('${tm22}'),(select count(*) from shifts where shift='B' and shift_from <= current_date and shift_to >= current_date group by shift limit 1), if(shifts.shift = 'E' and time_to_sec('${tm}') >=  time_to_sec('${tm18}'),(select count(*) from shifts where shift='E' and shift_from <= current_date and shift_to >= current_date group by shift limit 1), if(shifts.shift = 'C' and time_to_sec('${tm}') >=  time_to_sec('${tm22}'),(select count(*) from shifts where shift='C' and shift_from <= current_date and shift_to >= current_date group by shift limit 1), 0))))) as expected FROM shifts left join data on data.emp_code = shifts.emp_code and data.dt = CURRENT_DATE and shifts.shift_from <= current_date and shifts.shift_to >= current_date and out_time is null and data.shift <> 'NA' group by shift order by FIELD(shifts.shift,'A','G','B','E','C')`

        // var smsquery = `SELECT s.shift, count(d.emp_code) as present, count(*) as expected FROM shifts s left join data d on d.dt = CURRENT_DATE and s.emp_code = d.emp_code where s.shift_from <= CURRENT_DATE and s.shift_to >= CURRENT_DATE group by s.shift order by field(s.shift, 'a', 'g', 'b', 'e', 'c')`

        console.log('sms', smsquery)

        var smsq = Knex.raw(smsquery)
        var message = ''

        smsq.then((result) => {
          if (result[0].length) {
            result[0].forEach((item) => {
              // var expected = 0

              // if (item.shift === 'A' && moment(tm).isSameOrAfter(moment(tm6)) && moment(tm).isBefore(moment(tm14))) {
              //   expected = item.expected
              // }
              // if (item.shift === 'G' && moment(tm).isSameOrAfter(moment(tm830)) && moment(tm).isBefore(moment(tm1730))) {
              //   expected = item.expected
              // }
              // if (item.shift === 'B' && moment(tm).isSameOrAfter(moment(tm14)) && moment(tm).isBefore(moment(tm22))) {
              //   expected = item.expected
              // }
              // if (item.shift === 'E' && (moment(tm).isSameOrAfter(moment(tm18)) || moment(tm).isBefore(moment(tm2)))) {
              //   expected = item.expected
              // }
              // if (item.shift === 'C' && (moment(tm).isSameOrAfter(moment(tm22)) || moment(tm).isBefore(moment(tm6)))) {
              //   expected = item.expected
              // }

              message += item.shift + ' - ' + item.present + '/' + item.expected + '     '
            })
            if (message) {
              message = tm.substr(0, tm.length - 3) + ': ' + message.substr(0, message.length - 2)
              if (!to) {
                // nik 9491273518
                // 9703400284,
                // 9441604400
                // kir: 8500373704
                to = '9885721144,8500373704,9703400284'
              }
              if (to && message) {
                // console.log(`SMS sent: ${to}, ${message}`)
                var request2 = require('request')
                const url = 'http://login.smsmoon.com/API/sms.php'
                const body = {
                  'username': 'Raghugroup',
                  'password': 'Abcd@1234',
                  'from': 'AKSOFT',
                  'to': to,
                  'msg': message,
                  'type': '1',
                  'dnd_check': '0'
                }

                console.log('sms:', message)
                request2.post(url, {
                  form: body
                }, function (error, response, body) {
                  if (!error && parseInt(response.statusCode) === 200) {
                    console.log(body) // Print the google web page.

                    Knex('sms').insert({
                      mobile: to,
                      message: message
                    }).then((result) => {
                      // console.log(result)
                    })

                    reply({
                      success: true,
                      data: 'SMS sent successfully'
                    })
                  }
                })
              } else {
                reply({
                  success: false,
                  error: 'Sending SMS failed'
                })
              }
            }
          }
        })
      }

      if (!tm) {
        /*
        query = Knex.raw(`SELECT shifts.dept as deptname, data.shift, count(data.shift) as present,
        if (data.shift = 'a' and current_time >= '06:00' and current_time < '14:00', (select count(*) as total from shifts where shift=data.shift and dept=deptname and shifts.shift_from <= CURRENT_DATE and shifts.shift_to >= CURRENT_DATE),
        if (data.shift = 'g' and current_time >= '08:30' and current_time < '17:30', (select count(*) as total from shifts where shift=data.shift  and dept=deptname and shifts.shift_from <= CURRENT_DATE and shifts.shift_to >= CURRENT_DATE),
        if (data.shift = 'b' and current_time >= '14:00' and current_time < '22:00', (select count(*) as total from shifts where shift=data.shift and dept=deptname and shifts.shift_from <= CURRENT_DATE and shifts.shift_to >= CURRENT_DATE ),
        if (data.shift = 'e' and current_time >= '18:00' and current_time < '02:00', (select count(*) as total from shifts where shift=data.shift  and dept=deptname and shifts.shift_from <= CURRENT_DATE and shifts.shift_to >= CURRENT_DATE),
        if (data.shift = 'c' and current_time >= '22:00' and current_time < '06:00', (select count(*) as total from shifts where shift=data.shift  and dept=deptname and shifts.shift_from <= CURRENT_DATE and shifts.shift_to >= CURRENT_DATE), 0))))) as expected FROM data
        inner join shifts on shifts.emp_code = data.emp_code and shifts.shift_from <= CURRENT_DATE and shifts.shift_to >= CURRENT_DATE
        WHERE closed = 0 and (dt = CURRENT_DATE or dt = subdate(current_date, 1)) and out_time is null and shifts.shift_from <= CURRENT_DATE and shifts.shift_to >= CURRENT_DATE group by data.shift, shifts.dept order by shift asc,present desc,expected desc`)
        */

        query = Knex.raw(`select shifts.dept as deptname, shifts.shift, count(*) as expected, count(data.emp_code) as present from shifts left join data on data.out_time is null and data.closed = 0 and data.emp_code = shifts.emp_code where shift_from <= current_date and shift_to >= current_date group by shifts.dept, shifts.shift order by shifts.shift, present, shifts.dept`)

        query.then((result) => {
          if (result[0].length) {
            reply({
              success: true,
              update_tm: moment().format('HH:mm on ddd, Do MMM YYYY'),
              data: result[0]
            })
          } else {
            reply({
              success: false,
              message: 'No data found'
            })
          }
        })
      }
    }
  },

  /* Insert into email table */
  {
    path: '/mailentry',
    method: 'GET',
    handler: (request, reply) => {
      console.log('params are', request.query)
      var params = request.query
      var tm = params.tm

      console.log(`in dept, ${tm}`)
      var today = moment().format('YYYY-MM-DD')
      var origtime = today + ' ' + tm
      tm = today + ' ' + tm
      var tm6 = today + ' 06:00:00'
      var tm14 = today + ' 14:00:00'
      var tm830 = today + ' 08:30:00'
      var tm1730 = today + ' 17:30:00'
      var tm1415 = today + ' 14:15:00'
      var tm22 = today + ' 22:00:00'
      var tm18 = today + ' 18:00:00'

      var deptq = `insert into email(dt, tm, deptname, shift, emp_type, present, expected) (SELECT current_date as dt, '${origtime}' as tm, s.dept, s.shift, s.emp_type, count(d.emp_code) as present, if(s.shift = 'A' and time_to_sec('${tm}') >=  time_to_sec('${tm6}') and time_to_sec('${tm}') <=  time_to_sec('${tm14}'),(select count(*) from shifts where dept = s.dept and shift=s.shift and emp_type = s.emp_type and shift_from <= current_date and shift_to >= current_date group by dept, shift, emp_type limit 1),if(s.shift = 'G' and time_to_sec('${tm}') >=  time_to_sec('${tm830}') and time_to_sec('${tm}') <=  time_to_sec('${tm1730}'),(select count(*) from shifts where dept = s.dept and shift=s.shift and emp_type = s.emp_type and shift_from <= current_date and shift_to >= current_date group by dept, shift, emp_type limit 1),if(s.shift = 'B' and time_to_sec('${tm}') >=  time_to_sec('${tm1415}') and time_to_sec('${tm}') <=  time_to_sec('${tm22}'),(select count(*) from shifts where dept = s.dept and shift=s.shift and emp_type = s.emp_type and shift_from <= current_date and shift_to >= current_date group by dept, shift, emp_type limit 1), if(s.shift = 'E' and time_to_sec('${tm}') >=  time_to_sec('${tm18}'),(select count(*) from shifts where dept = s.dept and shift=s.shift and emp_type = s.emp_type and shift_from <= current_date and shift_to >= current_date group by dept, shift, emp_type limit 1),if(s.shift = 'C' and time_to_sec('${tm}') >=  time_to_sec('${tm22}'),(select count(*) from shifts where dept = s.dept and shift=s.shift and emp_type = s.emp_type and shift_from <= current_date and shift_to >= current_date group by dept, shift, emp_type limit 1), 0))))) as expected FROM shifts s left join data d on d.emp_code = s.emp_code and d.dt = current_date and out_time is null 
      where s.shift_from <= CURRENT_DATE and s.shift_to >= CURRENT_DATE 
      group by s.dept, s.shift, s.emp_type order by shift)`

      console.log(deptq)
      Knex.raw(deptq).then((result) => {
        reply({
          success: true,
          result})
      })
    }
  },

  // ////////////////////
  /* Admin */
  // {
  //   path: '/clear',
  //   method: 'GET',
  //   handler: (request, reply) => {
  //     Knex.raw('truncate table data').then((result) => {
  //       Knex.raw('truncate table email').then((result) => {
  //         Knex.raw('truncate table sms').then((result) => {
  //           reply({
  //             success: true,
  //             message: 'Data cleared'
  //           })
  //         })
  //       })
  //     })
  //   }
  // },

  // auto close
  {
    path: '/autoclose',
    method: 'GET',
    handler: (request, reply) => {
      var type = parseInt(request.query.type)
      var query = `update data set closed = 1 where closed = 0 and (shift = 'A' or shift = 'G' or shift = 'B')`
      if (type === 2) {
        // query = `update data set closed = 1 where (shift = 'E' or shift = 'C') and closed = 0`
        query = `update data set closed = 1 where closed = 0 and dt < current_date`
      }
      Knex.raw(query).then((result) => {
        reply({
          success: true,
          data: 'Auto close records finished'
        })
      })
    }
  },

  /* Mail */
  {
    path: '/mail',
    method: 'GET',
    handler: (request, reply) => {
      console.log('in mail function')

      var message = ''
      var mispunch = ''
      var absentees = ''
      var notInShiftSchedule = ''

      // yesterdday
      let query = Knex.raw(`select * from email where dt = subdate(current_date, 1) and (expected > 0 or present > 0) order by deptname, tm`)
      // today
      // let query = Knex.raw(`select * from email where dt = current_date and (expected > 0 or present > 0) order by deptname, tm `)

      // console.log('in mail')

      query.then((results) => {
        if (!results || results[0].length === 0) {
          message = 'No data found'
        } else {
          var data = results[0]
          var types = ['Direct', 'Indirect']
          types.forEach((type) => {
            var t = data.filter(function (item) {
              console.log(item)
              return item.emp_type === type
            })
            var depts = _.uniq(_.pluck(t, 'deptname'))
            // console.log('departments are', depts)
            var currentDepartment = null

            message += `<h3>${type}</h3><table style="width:100%">
                <tr>
                <th style="background-color:#676767;color:#fff;" width="15%">Department</th>
                <th style="background-color:#676767;color:#fff;width:5px;" colspan="6"> Shift A<br> (report taken at 06:15)</th>
                <th style="background-color:#676767;width:5px;color:#fff" colspan="6"> Shift G <br>(report taken at 08:45) </th>
                <th style="background-color:#676767;width:5px;color:#fff" colspan="6"> Shift B <br>(report taken at 14:15) </th>
                <th style="background-color:#676767;width:5px;color:#fff" colspan="6"> Shift E <br>(report taken at 18:15) </th>
                <th style="background-color:#676767;width:5px;color:#fff" colspan="6">Shift C <br>(report taken at 22:15) </th>
    
                </tr>
        
                <tr>
                <th style="background-color:#cecdcc;color:#fff"></th>
                <th style="
                font-size: 15px
                font-weight: 700
                width:5px
                color: #020202
                background: #34efaa;">A</th>
                <th style="
                font-size: 15px
                font-weight: 700
                width: 5px; color: #020202
                background: #34efaa;"> G </th>
                <th style="
                font-size: 15px
                font-weight: 700
                width:5px;color: #020202
                background: #34efaa;"> B</th>
                <th style="
               
                font-size: 15px
                font-weight: 700
                width:5px;color: #020202
                background: #34efaa;"> E </th>
                <th style="
                
                 font-size: 15px
                 font-weight: 700
                 width:5px;color: #020202
                 background: #34efaa;"> C </th>
                 <th style="
                 
                  font-size: 15px
                  font-weight: 700
                  width:5px;color: #020202
                  background: #09888e;">SC</th>
                <!-- 2nd th -->
                <th style="
                font-size: 15px
                font-weight: 700
                width:5px
                color: #020202
                background: #34efaa;">A</th>
                <th style="
                font-size: 15px
                font-weight: 700
                width: 5px; color: #020202
                background: #34efaa;"> G </th>
                <th style="
                font-size: 15px
                font-weight: 700
                width:5px;color: #020202
                background: #34efaa;"> B</th>
                <th style="
               
                font-size: 15px
                font-weight: 700
                width:5px;color: #020202
                background: #34efaa;"> E </th>
                <th style="
               
                font-size: 15px
                font-weight: 700
                width:5px;color: #020202
                background: #34efaa;"> C </th>
                <th style="
                
                 font-size: 15px
                 font-weight: 700
                 width:5px;color: #020202
                 background: #09888e;">SC</th>
    
                <!-- 3nd th -->
                <th style="
                font-size: 15px
                font-weight: 700
                width:5px
                color: #020202
                background: #34efaa;">A</th>
                <th style="
                font-size: 15px
                font-weight: 700
                width: 5px; color: #020202
                background: #34efaa;"> G </th>
                <th style="
                font-size: 15px
                font-weight: 700
                width:5px;color: #020202
                background: #34efaa;"> B</th>
                <th style="
               
                font-size: 15px
                font-weight: 700
                width:5px;color: #020202
                background: #34efaa;"> E </th>
                <th style="
               
                font-size: 15px
                font-weight: 700
                width:5px;color: #020202
                background: #34efaa;"> C </th>
    
                <th style="
                
                 font-size: 15px
                 font-weight: 700
                 width:5px;color: #020202
                 background: #09888e;">SC</th>
                <!-- 4th th -->
                <th style="
                font-size: 15px
                font-weight: 700
                width:5px
                color: #020202
                background: #34efaa;">A</th>
                <th style="
                font-size: 15px
                font-weight: 700
                width: 5px; color: #020202
                background: #34efaa;"> G </th>
                <th style="
                font-size: 15px
                font-weight: 700
                width:5px;color: #020202
                background: #34efaa;"> B</th>
                <th style="
               
                font-size: 15px
                font-weight: 700
                width:5px;color: #020202
                background: #34efaa;"> E </th>
                <th style="
               
                font-size: 15px
                font-weight: 700
                width:5px;color: #020202
                background: #34efaa;"> C </th>
                <th style="
                
                 font-size: 15px
                 font-weight: 700
                 width:5px;color: #020202
                 background: #09888e;">SC</th>
                <!-- 5th th -->
                   <th style="
                font-size: 15px
                font-weight: 700
                width:5px
                color: #020202
                background: #34efaa;">A</th>
                <th style="
                font-size: 15px
                font-weight: 700
                width: 5px; color: #020202
                background: #34efaa;"> G </th>
                <th style="
                font-size: 15px
                font-weight: 700
                width:5px;color: #020202
                background: #34efaa;"> B</th>
                <th style="
               
                font-size: 15px
                font-weight: 700
                width:5px;color: #020202
                background: #34efaa;"> E </th>
                <th style="
               
                font-size: 15px
                font-weight: 700
                width:5px;color: #020202
                background: #34efaa;"> C </th>
                <th style="
                
                 font-size: 15px
                 font-weight: 700
                 width:5px;color: #020202
                 background: #09888e;">SC</th>
            </tr>`

            depts.forEach((dept) => {
              if (dept === currentDepartment) {
                message += `<tr>`
              } else {
                currentDepartment = dept
                message += `<tr><td style="background: #cecdcc" align="center" width="5px">${dept}</td>`
              }

              let timings = [
                '06:15:00',
                '08:45:00',
                '14:15:00',
                '18:15:00',
                '22:15:00'
              ]
              timings.forEach((time) => {
                // message += `<td>${time}</td>`

                // console.log('abc', dept, time)

                var a = _.filter(t, function (num) {
                  return num.deptname === dept && num.tm === time.substr(0, 8) && num.shift === 'A'
                })
                var b = _.filter(t, function (num) {
                  return num.deptname === dept && num.tm === time.substr(0, 8) && num.shift === 'B'
                })
                var c = _.filter(t, function (num) {
                  return num.deptname === dept && num.tm === time.substr(0, 8) && num.shift === 'C'
                })
                var e = _.filter(t, function (num) {
                  return num.deptname === dept && num.tm === time.substr(0, 8) && num.shift === 'E'
                })
                var g = _.filter(t, function (num) {
                  return num.deptname === dept && num.tm === time.substr(0, 8) && num.shift === 'G'
                })

                var total = 0
                var expected = 0
                if (time === '06:15:00') {
                  if (a[0] && a[0].present) {
                    message += `<td align="center" style="background: #e21b1b;color:#fff">${a[0].present}</td>`
                    total += parseInt(a[0].present)
                    expected = a[0].expected
                  } else {
                    message += `<td align="center" style="background: #e21b1b;color:#fff"></td>`
                  }
                  if (g[0] && g[0].present && parseInt(g[0].present) !== 0) {
                    message += `<td align="center" style="background: #ab6712;color:#fff">${g[0].present}</td>`
                  } else {
                    message += `<td align="center" style="background: #ab6712;color:#fff"></td>`
                  }
                  if (b[0] && b[0].present && parseInt(b[0].present) !== 0) {
                    message += `<td align="center" style="background: #ab6712;color:#fff">${b[0].present}</td>`
                  } else {
                    message += `<td align="center" style="background: #ab6712;color:#fff"></td>`
                  }
                  if (e[0] && e[0].present && parseInt(e[0].present) !== 0) {
                    message += `<td align="center" style="background: #ab6712;color:#fff">${e[0].present}</td>`
                  } else {
                    message += `<td align="center" style="background: #ab6712;color:#fff"></td>`
                  }
                  if (c[0] && c[0].present && parseInt(c[0].present) !== 0) {
                    message += `<td align="center" style="background: #ab6712;color:#fff">${c[0].present}</td>`
                  } else {
                    message += `<td align="center" style="background: #ab6712;color:#fff"></td>`
                  }
                  message += `<td align="center" style="background: #09888e;color:#fff">${total}/${expected}</td>`
                }

                if (time === '08:45:00') {
                  if (a[0] && a[0].present && parseInt(a[0].present) !== 0) {
                    message += `<td align="center" style="background: #ab6712;color:#fff">${a[0].present}</td>`
                  } else {
                    message += `<td align="center" style="background: #ab6712;color:#fff"></td>`
                  }
                  if (g[0] && g[0].present) {
                    message += `<td align="center" style="background: #e21b1b;color:#fff">${g[0].present}</td>`
                    total += parseInt(g[0].present)
                    expected = g[0].expected
                  } else {
                    message += `<td align="center" style="background: #e21b1b;color:#fff"></td>`
                  }
                  if (b[0] && b[0].present && parseInt(b[0].present) !== 0) {
                    message += `<td align="center" style="background: #ab6712;color:#fff">${b[0].present}</td>`
                  } else {
                    message += `<td align="center" style="background: #ab6712;color:#fff"></td>`
                  }
                  if (e[0] && e[0].present && parseInt(e[0].present) !== 0) {
                    message += `<td align="center" style="background: #ab6712;color:#fff">${e[0].present}</td>`
                  } else {
                    message += `<td align="center" style="background: #ab6712;color:#fff"></td>`
                  }
                  if (c[0] && c[0].present && parseInt(c[0].present) !== 0) {
                    message += `<td align="center" style="background: #ab6712;color:#fff">${c[0].present}</td>`
                  } else {
                    message += `<td align="center" style="background: #ab6712;color:#fff"></td>`
                  }
                  message += `<td align="center" style="background: #09888e;color:#fff">${total}/${expected}</td>`
                }

                if (time === '14:15:00') {
                  if (a[0] && a[0].present && parseInt(a[0].present) !== 0) {
                    message += `<td align="center" style="background: #ab6712;color:#fff">${a[0].present}</td>`
                  } else {
                    message += `<td align="center" style="background: #ab6712;color:#fff"></td>`
                  }
                  if (g[0] && g[0].present && parseInt(g[0].present) !== 0) {
                    message += `<td align="center" style="background: #ab6712;color:#fff">${g[0].present}</td>`
                  } else {
                    message += `<td align="center" style="background: #ab6712;color:#fff"></td>`
                  }
                  if (b[0] && b[0].present) {
                    message += `<td align="center" style="background: #e21b1b;color:#fff">${b[0].present}</td>`
                    total += parseInt(b[0].present)
                    expected = b[0].expected
                  } else {
                    message += `<td align="center" style="background: #e21b1b;color:#fff"></td>`
                  }
                  if (e[0] && e[0].present && parseInt(e[0].present) !== 0) {
                    message += `<td align="center" style="background: #ab6712;color:#fff">${e[0].present}</td>`
                  } else {
                    message += `<td align="center" style="background: #ab6712;color:#fff"></td>`
                  }
                  if (c[0] && c[0].present && parseInt(c[0].present) !== 0) {
                    message += `<td align="center" style="background: #ab6712;color:#fff">${c[0].present}</td>`
                  } else {
                    message += `<td align="center" style="background: #ab6712;color:#fff"></td>`
                  }
                  message += `<td align="center" style="background: #09888e;color:#fff">${total}/${expected}</td>`
                }

                if (time === '18:15:00') {
                  if (a[0] && a[0].present && parseInt(a[0].present) !== 0) {
                    message += `<td align="center" style="background: #ab6712;color:#fff">${a[0].present}</td>`
                  } else {
                    message += `<td align="center" style="background: #ab6712;color:#fff"></td>`
                  }
                  if (g[0] && g[0].present && parseInt(g[0].present) !== 0) {
                    message += `<td align="center" style="background: #ab6712;color:#fff">${g[0].present}</td>`
                  } else {
                    message += `<td align="center" style="background: #ab6712;color:#fff"></td>`
                  }
                  if (b[0] && b[0].present && parseInt(b[0].present) !== 0) {
                    message += `<td align="center" style="background: #ab6712;color:#fff">${b[0].present}</td>`
                  } else {
                    message += `<td align="center" style="background: #ab6712;color:#fff"></td>`
                  }
                  if (e[0] && e[0].present) {
                    message += `<td align="center" style="background: #e21b1b;color:#fff">${e[0].present}</td>`
                    total += parseInt(e[0].present)
                    expected = e[0].expected
                  } else {
                    message += `<td align="center" style="background: #e21b1b;color:#fff"></td>`
                  }
                  if (c[0] && c[0].present && parseInt(c[0].present) !== 0) {
                    message += `<td align="center" style="background: #ab6712;color:#fff">${c[0].present}</td>`
                  } else {
                    message += `<td align="center" style="background: #ab6712;color:#fff"></td>`
                  }
                  message += `<td align="center" style="background: #09888e;color:#fff">${total}/${expected}</td>`
                }

                if (time === '22:15:00') {
                  if (a[0] && a[0].present && parseInt(a[0].present) !== 0) {
                    message += `<td align="center" style="background: #ab6712;color:#fff">${a[0].present}</td>`
                  } else {
                    message += `<td align="center" style="background: #ab6712;color:#fff"></td>`
                  }
                  if (g[0] && g[0].present && parseInt(g[0].present) !== 0) {
                    message += `<td align="center" style="background: #ab6712;color:#fff">${g[0].present}</td>`
                  } else {
                    message += `<td align="center" style="background: #ab6712;color:#fff"></td>`
                  }
                  if (b[0] && b[0].present && parseInt(b[0].present) !== 0) {
                    message += `<td align="center" style="background: #ab6712;color:#fff">${b[0].present}</td>`
                  } else {
                    message += `<td align="center" style="background: #ab6712;color:#fff"></td>`
                  }
                  if (e[0] && e[0].present && parseInt(e[0].present) !== 0) {
                    message += `<td align="center" style="background: #ab6712;color:#fff">${e[0].present}</td>`
                  } else {
                    message += `<td align="center" style="background: #ab6712;color:#fff"></td>`
                  }
                  if (c[0] && c[0].present) {
                    message += `<td align="center" style="background: #e21b1b;color:#fff">${c[0].present}</td>`
                    total += parseInt(c[0].present)
                    expected = c[0].expected
                  } else {
                    message += `<td align="center" style="background: #e21b1b;color:#fff"></td>`
                  }
                  message += `<td align="center" style="background: #09888e;color:#fff">${total}/${expected}</td>`
                }
              })
              message += `</tr>`
            })
            message += `</table>`
          })
        }

        // Mispunches
        Knex.raw(`SELECT d.emp_code, s.name, s.shift, d.in_time, d.out_time, s.dept, s.designation FROM data d left join shifts s on s.emp_code = d.emp_code and s.shift_from <= subdate(CURRENT_DATE, 1) and s.shift_to >= subdate(current_date,1) WHERE dt = subdate(current_date, 1) and closed = 1 and out_time is null order by shift, dept, in_time`).then((result) => {
          if (result && result[0].length) {
            mispunch += `<table style="width:70%; background-color:#cecdcc"> 
             <tr>
                <th style="background-color:#676767;color:#fff;"> Emp Code</th>
                <th style="background-color:#676767;color:#fff"> Name</th>
                <th style="background-color:#676767;color:#fff" > Shift </th>
                <th style="background-color:#676767;color:#fff" > Punch </th>
                <th style="background-color:#676767;color:#fff" > Department</th>
                <th style="background-color:#676767;color:#fff"> Designation </th>
    
                </tr>
                `
            var temp = result[0]
            temp.forEach((item) => {
              var empCode = item['emp_code']
              var name = item['name'] != null ? item['name'] : '-'
              var shift = item['shift'] != null ? item['shift'] : '-'
              var inTime = item['in_time'] != null ? item['in_time'] : '-'
              // var outTime = item['out_time'] != null ? item['out_time'] : '-'
              var dept = item['dept'] != null ? item['dept'] : '-'
              var designation = item['designation'] != null ? item['designation'] : '-'

              mispunch += `<tr><td align="center">${empCode}</td><td style="padding-left:5px">${name}</td><td style="padding-left:5px">${shift}</td><td style="padding-left:5px">${inTime}</td><td style="padding-left:5px">${dept}</td><td style="padding-left:5px">${designation}</td></tr>`
            })
            mispunch += `</table>`
          }

          // Ab(message, mispunch, absentees) {sentees
          Knex.raw(`SELECT * FROM shifts WHERE shift_from <= subdate(current_date, 1) and shift_to >= subdate(current_date,1) and emp_code not in (select emp_code from data where dt = subdate(current_date, 1))`).then((result) => {
            if (result && result[0].length) {
              absentees += `<table style="width:70%; background-color:#cecdcc"> 
             <tr>
                <th style="background-color:#676767;color:#fff;"> Emp Code</th>
                <th style="background-color:#676767;color:#fff"> Name</th>
                <th style="background-color:#676767;color:#fff" > Shift </th>
                <th style="background-color:#676767;color:#fff" > Department</th>
                <th style="background-color:#676767;color:#fff"> Designation </th>
    
                </tr>
                `
              var temp = result[0]
              temp.forEach((item) => {
                var empCode = item['emp_code']
                var name = item['name'] != null ? item['name'] : '-'
                var shift = item['shift'] != null ? item['shift'] : '-'
                // var inTime = item['in_time'] != null ? item['in_time'] : '-'
                // var outTime = item['out_time'] != null ? item['out_time'] : '-'
                var dept = item['dept'] != null ? item['dept'] : '-'
                var designation = item['designation'] != null ? item['designation'] : '-'

                absentees += `<tr><td align="center">${empCode}</td><td style="padding-left:5px">${name}</td><td style="padding-left:5px">${shift}</td><td style="padding-left:5px">${dept}</td><td style="padding-left:5px">${designation}</td></tr>`
              })
              absentees += `</table>`
            }

            // Employees present, but not in shift schedule
            Knex.raw(`SELECT * FROM data WHERE dt = subdate(CURRENT_DATE, 1) and emp_code not in (select emp_code from shifts where shift_from <= subdate(CURRENT_DATE, 1) and shift_to >= subdate(CURRENT_DATE, 1))`).then((result) => {
              if (result && result[0].length) {
                notInShiftSchedule += `<table style="width:70%; background-color:#cecdcc"><tr><th style="background-color:#676767;color:#fff;"> Emp Code</th><th style="background-color:#676767;color:#fff" >In Punch</th><th style="background-color:#676767;color:#fff">Out Punch</th></tr>`
                var temp = result[0]
                temp.forEach((item) => {
                  var empCode = item['emp_code']
                  // var name = item['name'] != null ? item['name'] : '-'
                  // var shift = item['shift'] != null ? item['shift'] : '-'
                  var inTime = item['in_time'] != null ? item['in_time'] : '-'
                  var outTime = item['out_time'] != null ? item['out_time'] : '-'
                  // var dept = item['dept'] != null ? item['dept'] : '-'
                  // var designation = item['designation'] != null ? item['designation'] : '-'

                  notInShiftSchedule += `<tr><td align="center">${empCode}</td><td style="padding-left:5px">${inTime}</td><td style="padding-left:5px">${outTime}</td></tr>`
                })
                notInShiftSchedule += `</table>`
              }

              mail(reply, message, mispunch, absentees, notInShiftSchedule)
            }).catch((err) => {
              reply('server-side error' + err)
            })
          }).catch((err) => {
            reply('server-side error' + err)
          })
        }).catch((err) => {
          reply('server-side error' + err)
        })
      })
    }
  },

  /* Migration */
  {
    path: '/export',
    method: 'POST',
    handler: (request, reply) => {
      console.log('in export method. month sent is ' + request.payload.month)
      if (request.payload.month) {
        let condition = `year(dt) = year('${request.payload.month}') and month(dt) = month('${request.payload.month}')`
        var mysqlDump = require('mysqldump')
        mysqlDump({
          host: config.DB_HOST,
          user: config.DB_USER,
          password: config.DB_PASSWORD,
          database: config.DB_DB,
          tables: ['data'],
          where: {'data': condition},
          ifNotExist: true,
          getDump: true
        }, function (err, data) {
          if (err) {
            reply({
              success: false,
              message: err
            })
          } else {
            reply(data)
              .bytes(data.length)
              .type('application/sql')
              .header('content-disposition', 'attachment; filename=data.sql;')

          // reply.file(data)
          // .header('Content-Type', 'application/sql')
          // .header('Content-Disposition', 'attachment; filename=' + 'reports.sql')
          }
        })
      } else {
        reply({
          success: false,
          message: 'Date is a required parameter'
        })
      }
    }
  },

  {
    path: '/export_dates',
    method: 'GET',
    handler: (request, reply) => {
      Knex.raw(`select min(dt) as min_date, max(dt) as max_date from data`).then(result => {
        console.log(result)
        if (result && (result[0][0]['min_date'])) {
          reply({
            success: true,
            dateStart: moment(result[0][0]['min_date']).format('YYYY-MM-DD'),
            dateEnd: moment(result[0][0]['max_date']).format('YYYY-MM-DD')
          })
        } else {
          reply({
            success: false,
            message: 'No data found'
          })
        }
      })
    }
  }
]

function mail (reply, message, mispunch, absentees, notInShiftSchedule) {
  var transporter = nodemailer.createTransport({
    host: 'mail.akrivia.in',
    port: 465,
    secure: true,
    auth: {
      user: 'testmail@akrivia.in',
      pass: 'Aeiou@123'
    },
    tls: { rejectUnauthorized: false }
  })

  // send message
  var html = `<!DOCTYPE html><html><head><style>table,th,td {border: 1px solid black;border-collapse: collapse;}</style></head><body><h3>Employee Attendance Report - ` + moment(new Date()).add(-1, 'days').format('dddd, Do MMMM YYYY') + `</h3>${message}`

  if (mispunch) {
    html += `<h3>Mispunches</h3>${mispunch}`
  }

  if (absentees) {
    html += `<h3>Absentees</h3>${absentees}`
  }

  if (notInShiftSchedule) {
    html += `<h3>Employees not in Shift Schedule</h3>${notInShiftSchedule}`
  }

  html += `</body></html>`

  var mailOptions = {
    from: '"Akrivia" <support@akrivia.in>', // sender address
    to: 'kiran.ys@akrivia.in', // list of receivers
    cc: 'ramakrishna.cp@akrivia.in',
    bcc: 'vijay.m@akrivia.in',
    subject: 'MAPS - Employee Attendance Report for ' + moment(new Date()).add(-1, 'days').format('dddd, Do MMMM YYYY'), // Subject line
    text: 'MAPS - Employee Attendance Report', // plain text body
    html: html
  }

  // send mail only if message or mispunch exists
  if (message || mispunch || absentees) {
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        return console.log(error)
      }
      console.log('Message sent: %s', info.messageId)
    })
    reply({
      success: true,
      message: 'Mail sent'
    })
  }
}

function insertOrUpdate (knex, tableName, data) {
  const firstData = data[0] ? data[0] : data
  return knex.raw(knex(tableName).insert(data).toQuery() + ' ON DUPLICATE KEY UPDATE ' +
    Object.getOwnPropertyNames(firstData).map(field => `${field}=VALUES(${field})`).join(',  '))
}

export default routes
