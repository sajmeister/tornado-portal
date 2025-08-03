import fetch from 'node-fetch';

async function testLogin() {
  try {
    console.log('🧪 Testing Login Flow...');
    console.log('=====================================');
    
    // Test 1: Check if login page is accessible
    console.log('1. Testing login page accessibility...');
    const loginResponse = await fetch('http://localhost:3000/login');
    console.log(`   Login page status: ${loginResponse.status}`);
    
    // Test 2: Test login API
    console.log('\n2. Testing login API...');
    const loginApiResponse = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        strEmail: 'superadmin@tornado.com',
        strPassword: 'password123'
      })
    });
    
    const loginData = await loginApiResponse.json();
    console.log(`   Login API status: ${loginApiResponse.status}`);
    console.log(`   Login API response:`, loginData);
    
    // Test 3: Check if we got cookies
    const cookies = loginApiResponse.headers.get('set-cookie');
    console.log(`   Cookies received: ${cookies ? 'Yes' : 'No'}`);
    if (cookies) {
      console.log(`   Cookie value: ${cookies}`);
    }
    
    // Test 4: Try to access dashboard with cookies
    if (loginData.success && cookies) {
      console.log('\n3. Testing dashboard access...');
      const dashboardResponse = await fetch('http://localhost:3000/dashboard', {
        headers: {
          'Cookie': cookies
        }
      });
      console.log(`   Dashboard status: ${dashboardResponse.status}`);
      
      if (dashboardResponse.status === 200) {
        console.log('   ✅ Dashboard accessible!');
      } else {
        console.log('   ❌ Dashboard not accessible');
      }
    }
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
  } finally {
    process.exit(0);
  }
}

testLogin(); 