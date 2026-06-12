import { Client } from "pg";

async function testConnection(host: string, port: number, user: string) {
  const connectionString = `postgresql://${user}:HSM%40santheep@${host}:${port}/postgres`;
  console.log(`Testing ${host}:${port}...`);
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });
  try {
    await client.connect();
    console.log(`✅ Success connecting to ${host}!`);
    await client.end();
    return true;
  } catch (err: any) {
    console.log(`❌ Failed connecting to ${host}: ${err.message}`);
    return false;
  }
}

async function run() {
  const hosts = [
    { host: "aws-0-ap-northeast-1.pooler.supabase.com", port: 6543, user: "postgres.dohwbntbwtnlnivnumei" },
    { host: "aws-0-ap-northeast-1.pooler.supabase.com", port: 5432, user: "postgres.dohwbntbwtnlnivnumei" },
    { host: "aws-0-ap-south-1.pooler.supabase.com", port: 6543, user: "postgres.dohwbntbwtnlnivnumei" },
    { host: "aws-0-ap-south-1.pooler.supabase.com", port: 5432, user: "postgres.dohwbntbwtnlnivnumei" },
  ];

  for (const h of hosts) {
    const success = await testConnection(h.host, h.port, h.user);
    if (success) {
      console.log(`Found working connection: postgresql://${h.user}:PASSWORD@${h.host}:${h.port}/postgres?sslmode=no-verify`);
      break;
    }
  }
}

run();
