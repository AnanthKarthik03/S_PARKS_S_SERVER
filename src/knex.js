const config = require('./config')

export default require('knex')({
  client: 'mysql',
  connection: {
    host: config.DB_HOST,
    user: config.DB_USER,
    password: config.DB_PASSWORD,
    database: config.DB_DB,
    charset: 'utf8'
  }
})
