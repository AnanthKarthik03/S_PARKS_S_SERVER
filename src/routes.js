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
var request2 = require('request')
var smsTo = '9885721144'

const routes = [

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

      // let query = Knex.raw(`select emp_code, name, designation, emp_type, shift, shift_from, shift_to, dept from shifts where shift_from <= '${date}' and shift_to >= '${date}' order by emp_code, created_at desc`)

      let query = Knex.raw(`select s1.emp_code, s1.name, s1.designation, s1.emp_type, s1.shift, s1.shift_from, s1.shift_to, s1.dept from shifts s1 WHERE s1.created_at = (SELECT MAX(s2.created_at) FROM shifts s2 WHERE s2.emp_code = s1.emp_code and shift_from <= '${date}' and shift_to >= '${date}') and shift_from <= '${date}' and shift_to >= '${date}'  ORDER BY s1.emp_code ASC`)

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


  /* get all available categories list  */
  {
    path: '/get/categories/list',
    method: 'GET',
    handler: (request, reply) => {
      Knex.raw(" SELECT * FROM category WHERE status = 1 ").then((result) => {

        return reply({
          success: true,
          data: result[0]
        })

      })
    }
  },


  /* get all available food types list  */
  {
    path: '/get/food/types/list',
    method: 'GET',
    handler: (request, reply) => {
      Knex.raw(" SELECT * FROM food_types ").then((result) => {

        return reply({
          success: true,
          data: result[0]
        })

      })
    }
  },


  // Shift Schedule
  {
    path: '/get/fooditems/cid/ft_id',
    method: 'POST',
    config: {
      auth: {
        strategy: 'token'
      }
    },
    handler: (request, reply) => {
      var category_id = request.payload.category_id;
      var type_id = request.payload.type_id;

      let query = Knex.raw(` SELECT * FROM food_items WHERE category_id = '${category_id}' and type_id = '${type_id}' `)

      // console.log(query)

      query.then((results) => {
     
          reply({
            success: true,
            dataCount: results[0].length,
            data: results[0]
          })
      
      }).catch((err) => {
        reply('server-side error' + err)
      })
    }
  },



]


function insertOrUpdate(knex, tableName, data) {
  const firstData = data[0] ? data[0] : data
  return knex.raw(knex(tableName).insert(data).toQuery() + ' ON DUPLICATE KEY UPDATE ' +
    Object.getOwnPropertyNames(firstData).map(field => `${field}=VALUES(${field})`).join(',  '))
}

export default routes
