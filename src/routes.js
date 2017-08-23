import Knex from './knex'
import jwt from 'jsonwebtoken'
const bcrypt = require('bcrypt')
var generator = require('generate-password')

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

        if (bcrypt.compareSync(password, user.password)) {
          const token = jwt.sign({
          username}, 'vZiYpmTzqXMp8PpYXKwqc9ShQ1UhyAfy', {
            algorithm: 'HS256',
            expiresIn: '1h'
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
        let hash = bcrypt.hashSync(newPassword, 10)

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
  }
]

export default routes
