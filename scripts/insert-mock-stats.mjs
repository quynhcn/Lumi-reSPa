import pg from 'pg';
const { Client } = pg;

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'require' ? { rejectUnauthorized: false } : undefined,
  });
  await client.connect();

  console.log('Generating mock customers...');
  // Insert 5000 customers
  const customers = [];
  for (let i = 0; i < 5000; i++) {
    customers.push(`('Khách hàng ${i}', '09${String(Math.floor(Math.random() * 100000000)).padStart(8, '0')}')`);
  }
  
  // Insert in batches of 1000
  for (let i = 0; i < customers.length; i += 1000) {
    const batch = customers.slice(i, i + 1000).join(',');
    await client.query(`INSERT INTO public.customers (name, phone) VALUES ${batch} ON CONFLICT DO NOTHING`);
  }

  console.log('Generating mock appointments and reviews...');
  // We need to fetch 1200 customers to create appointments and reviews for them
  const { rows: dbCustomers } = await client.query('SELECT id FROM public.customers LIMIT 1200');
  
  // Also get a service ID and staff ID to attach to appointments
  const { rows: services } = await client.query('SELECT id FROM public.services LIMIT 1');
  const { rows: staff } = await client.query('SELECT id FROM public.staff LIMIT 1');
  
  const serviceId = services[0]?.id || null;
  const staffId = staff[0]?.id || null;
  
  for (let i = 0; i < dbCustomers.length; i++) {
    const customer = dbCustomers[i];
    
    // Create appointment
    const { rows: appt } = await client.query(
      `INSERT INTO public.appointments (customer_id, service_id, staff_id, start_time, end_time, status, price, duration_min) 
       VALUES ($1, $2, $3, now(), now() + interval '1 hour', 'completed', 0, 60) RETURNING id`,
      [customer.id, serviceId, staffId]
    );
    
    // Create review (ratings between 4 and 5 to get a 4.9 average)
    const rating = Math.random() > 0.1 ? 5 : 4;
    
    await client.query(
      `INSERT INTO public.reviews (appointment_id, customer_id, service_id, staff_id, rating, comment, is_published) 
       VALUES ($1, $2, $3, $4, $5, 'Dịch vụ tuyệt vời, sẽ quay lại!', true)`,
      [appt[0].id, customer.id, serviceId, staffId, rating]
    );
  }
  
  console.log('Successfully inserted mock customers and reviews into database!');
  await client.end();
}

main().catch(console.error);
