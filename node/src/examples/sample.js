
import migrami from '../index.js'

migrami({
    connectionString: process.env.DATABASE_URL
})