import { Client } from 'pg';

const candidatePasswords = [
  'postgres',
  'admin',
  'root',
  '1234',
  '123456',
  'password',
  'aditee',
  'Aditee',
  'disaster',
  '12345',
  'postgress',
  'pg',
  'sql',
  '12345678',
];

async function findWorkingPassword() {
  console.log('🔍 Testing candidate passwords for PostgreSQL user "postgres"...');
  
  for (const password of candidatePasswords) {
    const client = new Client({
      host: 'localhost',
      port: 5432,
      user: 'postgres',
      password: password,
      database: 'postgres',
      connectionTimeoutMillis: 2000,
    });

    try {
      await client.connect();
      console.log(`\n🎉 SUCCESS! The correct PostgreSQL password is: "${password}"`);
      await client.end();
      return password;
    } catch (err: any) {
      if (err.code === '28P01') {
        // Wrong password, continue
        process.stdout.write('.');
      } else {
        console.log(`\n⚠️ Connection Error (${err.code}): ${err.message}`);
        await client.end();
        return null;
      }
    }
  }

  console.log('\n❌ None of the standard default passwords matched.');
  return null;
}

findWorkingPassword();
