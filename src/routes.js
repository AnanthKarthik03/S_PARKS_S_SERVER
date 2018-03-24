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


  /* Dashboard employees */
  {
    path: '/employees',
    method: 'GET',
    handler: (request, reply) => {
      Knex.raw(`SELECT data.emp_code, data.dt, shifts.name, shifts.designation, shifts.dept, shifts.shift, shifts.emp_type, data.in_time FROM data inner join shifts on shifts.shift_from <= data.dt and shifts.shift_to >= data.dt and shifts.emp_code = data.emp_code and shifts.created_at = (SELECT MAX(s2.created_at) FROM shifts s2 WHERE s2.emp_code = shifts.emp_code and shift_from <= CURRENT_DATE and shift_to >= CURRENT_DATE) where closed = 0 and out_time is null and dt >= subdate(current_date, 1) group by data.emp_code ORDER BY in_time ASC, emp_code asc
      `).then((result) => {
        if (!result[0].length) {
          return reply({
            success: false,
            message: 'No records exist'
          })
        } else {
          return reply({
            success: true,
            data: result[0]
          })
        }
      })
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
      // var tm1730 = today + ' 17:30:00'
      var tm1730 = today + ' 17:00:00'
      var tm1415 = today + ' 14:15:00'
      var tm22 = today + ' 22:00:00'
      var tm18 = today + ' 18:00:00'

      // var deptq = `insert into email(dt, tm, deptname, shift, emp_type, present, expected) (SELECT current_date as dt, '${origtime}' as tm, s.dept, s.shift, s.emp_type, count(d.emp_code) as present, if(s.shift = 'A' and time_to_sec('${tm}') >=  time_to_sec('${tm6}') and time_to_sec('${tm}') <=  time_to_sec('${tm14}'),(select count(*) from shifts where dept = s.dept and shift=s.shift and emp_type = s.emp_type and shift_from <= current_date and shift_to >= current_date group by dept, shift, emp_type limit 1),if(s.shift = 'G' and time_to_sec('${tm}') >=  time_to_sec('${tm830}') and time_to_sec('${tm}') <=  time_to_sec('${tm1730}'),(select count(*) from shifts where dept = s.dept and shift=s.shift and emp_type = s.emp_type and shift_from <= current_date and shift_to >= current_date group by dept, shift, emp_type limit 1),if(s.shift = 'B' and time_to_sec('${tm}') >=  time_to_sec('${tm1415}') and time_to_sec('${tm}') <=  time_to_sec('${tm22}'),(select count(*) from shifts where dept = s.dept and shift=s.shift and emp_type = s.emp_type and shift_from <= current_date and shift_to >= current_date group by dept, shift, emp_type limit 1), if(s.shift = 'E' and time_to_sec('${tm}') >=  time_to_sec('${tm18}'),(select count(*) from shifts where dept = s.dept and shift=s.shift and emp_type = s.emp_type and shift_from <= current_date and shift_to >= current_date group by dept, shift, emp_type limit 1),if(s.shift = 'C' and time_to_sec('${tm}') >=  time_to_sec('${tm22}'),(select count(*) from shifts where dept = s.dept and shift=s.shift and emp_type = s.emp_type and shift_from <= current_date and shift_to >= current_date group by dept, shift, emp_type limit 1), 0))))) as expected FROM shifts s left join data d on d.emp_code = s.emp_code and d.dt = current_date and out_time is null where s.shift_from <= CURRENT_DATE and s.shift_to >= CURRENT_DATE
      // group by s.dept, s.shift, s.emp_type order by shift)`

      var deptq = `insert into email(dt, tm, deptname, shift, emp_type, present, expected) (SELECT current_date as dt, '${origtime}' as tm, s.dept, s.shift, s.emp_type, count(d.emp_code) as present, if(s.shift = 'A' and time_to_sec('${tm}') >=  time_to_sec('${tm6}') and time_to_sec('${tm}') <=  time_to_sec('${tm14}'),(select count(*) from shifts where  shifts.created_at = (SELECT MAX(s2.created_at) FROM shifts s2 WHERE s2.emp_code = shifts.emp_code and shift_from <= CURRENT_DATE and shift_to >= CURRENT_DATE) and dept = s.dept and shift=s.shift and emp_type = s.emp_type and shift_from <= current_date and shift_to >= current_date group by dept, shift, emp_type limit 1),if(s.shift = 'G' and time_to_sec('${tm}') >=  time_to_sec('${tm830}') and time_to_sec('${tm}') <=  time_to_sec('${tm1730}'),(select count(*) from shifts where  shifts.created_at = (SELECT MAX(s2.created_at) FROM shifts s2 WHERE s2.emp_code = shifts.emp_code and shift_from <= CURRENT_DATE and shift_to >= CURRENT_DATE) and dept = s.dept and shift=s.shift and emp_type = s.emp_type and shift_from <= current_date and shift_to >= current_date group by dept, shift, emp_type limit 1),if(s.shift = 'B' and time_to_sec('${tm}') >=  time_to_sec('${tm1415}') and time_to_sec('${tm}') <=  time_to_sec('${tm22}'),(select count(*) from shifts where  shifts.created_at = (SELECT MAX(s2.created_at) FROM shifts s2 WHERE s2.emp_code = shifts.emp_code and shift_from <= CURRENT_DATE and shift_to >= CURRENT_DATE) and dept = s.dept and shift=s.shift and emp_type = s.emp_type and shift_from <= current_date and shift_to >= current_date group by dept, shift, emp_type limit 1), if(s.shift = 'E' and time_to_sec('${tm}') >=  time_to_sec('${tm18}'),(select count(*) from shifts where  shifts.created_at = (SELECT MAX(s2.created_at) FROM shifts s2 WHERE s2.emp_code = shifts.emp_code and shift_from <= CURRENT_DATE and shift_to >= CURRENT_DATE) and dept = s.dept and shift=s.shift and emp_type = s.emp_type and shift_from <= current_date and shift_to >= current_date group by dept, shift, emp_type limit 1),if(s.shift = 'C' and time_to_sec('${tm}') >=  time_to_sec('${tm22}'),(select count(*) from shifts where  shifts.created_at = (SELECT MAX(s2.created_at) FROM shifts s2 WHERE s2.emp_code = shifts.emp_code and shift_from <= CURRENT_DATE and shift_to >= CURRENT_DATE) and dept = s.dept and shift=s.shift and emp_type = s.emp_type and shift_from <= current_date and shift_to >= current_date group by dept, shift, emp_type limit 1), 0))))) as expected FROM shifts s left join data d on d.emp_code = s.emp_code and d.dt = current_date and out_time is null where  s.created_at = (SELECT MAX(s2.created_at) FROM shifts s2 WHERE s2.emp_code = s.emp_code and shift_from <= CURRENT_DATE and shift_to >= CURRENT_DATE) and s.shift_from <= CURRENT_DATE and s.shift_to >= CURRENT_DATE group by s.dept, s.shift, s.emp_type order by shift)`

      console.log(deptq)
      Knex.raw(deptq).then((result) => {
        reply({
          success: true,
          result})
      })
    }
  },

]


function insertOrUpdate (knex, tableName, data) {
  const firstData = data[0] ? data[0] : data
  return knex.raw(knex(tableName).insert(data).toQuery() + ' ON DUPLICATE KEY UPDATE ' +
    Object.getOwnPropertyNames(firstData).map(field => `${field}=VALUES(${field})`).join(',  '))
}

export default routes
