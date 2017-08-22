import Knex from './knex'
import jwt from 'jsonwebtoken'
const bcrypt = require('bcrypt')

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
      Knex('users').select('username', 'name', 'mobile', 'email').then((results) => {
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
  }
]

export default routes
