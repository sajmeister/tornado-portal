import fetch from 'node-fetch';

async function testCompleteFlow() {
  try {
    console.log('🧪 Testing Complete Login → Dashboard Flow...');
    console.log('===============================================');
    
    // Step 1: Login
    console.log('\n1. 🔐 Logging in...');
    const loginResponse = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        strEmail: 'superadmin@tornado.com',
        strPassword: 'password123'
      })
    });
    
    const loginData = await loginResponse.json();
    console.log(`   Login status: ${loginResponse.status}`);
    console.log(`   Login success: ${loginData.success}`);
    
    if (!loginData.success) {
      console.log('   ❌ Login failed:', loginData.message);
      return;
    }
    
    // Step 2: Extract cookies
    const cookies = loginResponse.headers.get('set-cookie');
    console.log(`   Cookies received: ${cookies ? 'Yes' : 'No'}`);
    
    if (!cookies) {
      console.log('   ❌ No cookies received');
      return;
    }
    
    // Step 3: Test /api/auth/me endpoint
    console.log('\n2. 👤 Testing /api/auth/me...');
    const meResponse = await fetch('http://localhost:3000/api/auth/me', {
      headers: {
        'Cookie': cookies
      }
    });
    
    const meData = await meResponse.json();
    console.log(`   /me status: ${meResponse.status}`);
    console.log(`   /me success: ${meData.success}`);
    
    if (meData.success) {
      console.log(`   User: ${meData.user.strName} (${meData.user.strRole})`);
    } else {
      console.log('   ❌ /me failed:', meData.message);
    }
    
    // Step 4: Test dashboard access
    console.log('\n3. 🏠 Testing dashboard access...');
    const dashboardResponse = await fetch('http://localhost:3000/dashboard', {
      headers: {
        'Cookie': cookies
      }
    });
    
    console.log(`   Dashboard status: ${dashboardResponse.status}`);
    
    if (dashboardResponse.status === 200) {
      console.log('   ✅ Dashboard accessible!');
      const dashboardText = await dashboardResponse.text();
      console.log(`   Dashboard content length: ${dashboardText.length} characters`);
      if (dashboardText.includes('Tornado Portal')) {
        console.log('   ✅ Dashboard contains "Tornado Portal"');
      }
    } else if (dashboardResponse.status === 307) {
      console.log('   🔄 Dashboard redirecting (307)');
      const location = dashboardResponse.headers.get('location');
      console.log(`   Redirect location: ${location}`);
    } else {
      console.log('   ❌ Dashboard not accessible');
    }
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
  } finally {
    process.exit(0);
  }
}

testCompleteFlow(); 