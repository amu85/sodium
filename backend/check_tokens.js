const { readUsers } = require('./utils/userFileUtils');
const axios = require('axios');

async function check() {
    const users = readUsers();
    for (const user of users) {
        console.log(`Checking user: ${user.user_id}`);
        console.log(`API Key: ${user.api_key}`);
        console.log(`Access Token: ${user.access_token}`);
        
        try {
            const res = await axios.get('https://api.kite.trade/user/profile', {
                headers: {
                    'X-Kite-Version': '3',
                    'Authorization': `token ${user.api_key}:${user.access_token}`
                }
            });
            console.log(`Success: ${res.data.data.user_name}`);
        } catch (e) {
            console.error(`Error: ${e.response?.data?.message || e.message}`);
        }
    }
}
check();
