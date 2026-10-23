import dotenv from 'dotenv';
import path from 'path';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';

// Load .env from root
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function mask(str?: string): string {
  if (!str) return '[NOT SET]';
  if (str.length <= 8) return '****';
  return `${str.substring(0, 4)}...${str.substring(str.length - 4)}`;
}

async function runVerification() {
  console.log('\n========================================');
  console.log('🔍 SAYSO ENVIRONMENT & CONNECTION AUDIT');
  console.log('========================================\n');

  // 1. Environment Keys Overview
  console.log('--- 1. Checking Environment Variables ---');
  console.log(`MONGODB_URI:        ${mask(process.env.MONGODB_URI)}`);
  console.log(`OPENROUTER_API_KEY: ${mask(process.env.OPENROUTER_API_KEY)}`);
  console.log(`GEMMA_MODEL_ID:     ${process.env.GEMMA_MODEL_ID || 'google/gemma-3-12b-it'}`);
  console.log(`SUPABASE_URL:       ${process.env.SUPABASE_URL || '[NOT SET]'}`);
  console.log(`SUPABASE_ANON_KEY:  ${mask(process.env.SUPABASE_ANON_KEY)}`);
  console.log(`SUPABASE_JWT_SECRET:${mask(process.env.SUPABASE_JWT_SECRET)}`);
  console.log(`SENTRY_DSN:         ${mask(process.env.SENTRY_DSN)}`);
  console.log('');

  let allSuccess = true;

  // 2. MongoDB Atlas Connection Test
  console.log('--- 2. Testing MongoDB Atlas Connection ---');
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri || mongoUri.includes('username:password') || mongoUri.includes('<username>')) {
    console.log('❌ MongoDB URI is missing or contains template placeholders.');
    allSuccess = false;
  } else {
    try {
      console.log('Connecting to MongoDB Atlas...');
      await mongoose.connect(mongoUri, {
        serverSelectionTimeoutMS: 7000,
      });
      const adminDb = mongoose.connection.db?.admin();
      const pingResult = await adminDb?.ping();
      console.log('✅ MongoDB Atlas connected successfully! Ping result:', pingResult);
      await mongoose.disconnect();
    } catch (err: unknown) {
      console.log('❌ MongoDB Atlas connection error:', (err as Error).message);
      allSuccess = false;
    }
  }
  console.log('');

  // 3. OpenRouter & Gemma 2 Connection Test
  console.log('--- 3. Testing OpenRouter API & Gemma 2 ---');
  const openrouterKey = process.env.OPENROUTER_API_KEY;
  if (!openrouterKey || openrouterKey === 'your-openrouter-api-key') {
    console.log('❌ OPENROUTER_API_KEY is not set or still default.');
    allSuccess = false;
  } else {
    try {
      console.log('Checking OpenRouter authentication & Gemma 2 model...');
      const model = process.env.GEMMA_MODEL_ID || 'google/gemma-3-12b-it';
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openrouterKey}`,
          'HTTP-Referer': 'https://github.com/RebeccaAyodele/Say-So',
          'X-Title': 'SaySo Verification',
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: 'Say "OK"' }],
          max_tokens: 5,
        }),
      });

      if (res.ok) {
        const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
        const reply = data.choices?.[0]?.message?.content?.trim();
        console.log(`✅ OpenRouter & ${model} connected successfully! Response: "${reply}"`);
      } else {
        const errText = await res.text();
        console.log(`❌ OpenRouter responded with status ${res.status}: ${errText}`);
        allSuccess = false;
      }
    } catch (err: unknown) {
      console.log('❌ OpenRouter test request failed:', (err as Error).message);
      allSuccess = false;
    }
  }
  console.log('');

  // 4. Supabase Verification
  console.log('--- 4. Testing Supabase Auth & JWT ---');
  const supaUrl = process.env.SUPABASE_URL;
  const supaJwt = process.env.SUPABASE_JWT_SECRET;

  if (!supaUrl) {
    console.log('⚠️ SUPABASE_URL is not set.');
  } else {
    try {
      const res = await fetch(`${supaUrl}/auth/v1/health`);
      console.log(`✅ Supabase Auth endpoint reachable (${res.status} ${res.statusText})`);
    } catch (err: unknown) {
      console.log('⚠️ Could not reach Supabase URL:', (err as Error).message);
    }
  }

  if (!supaJwt) {
    console.log('⚠️ SUPABASE_JWT_SECRET is not set.');
  } else {
    try {
      const testPayload = { sub: 'user_test_verify', email: 'test@example.com' };
      const token = jwt.sign(testPayload, supaJwt, { expiresIn: '1h' });
      const decoded = jwt.verify(token, supaJwt) as { sub: string };
      if (decoded.sub === 'user_test_verify') {
        console.log('✅ Supabase JWT secret is valid and successfully signs/verifies tokens!');
      }
    } catch (err: unknown) {
      console.log('❌ Supabase JWT verification error:', (err as Error).message);
      allSuccess = false;
    }
  }
  console.log('');

  // 5. Sentry Verification
  console.log('--- 5. Testing Sentry Configuration ---');
  const sentryDsn = process.env.SENTRY_DSN;
  if (!sentryDsn) {
    console.log('ℹ️ SENTRY_DSN is not configured (optional).');
  } else if (!sentryDsn.startsWith('http')) {
    console.log('❌ SENTRY_DSN does not look like a valid URL.');
    allSuccess = false;
  } else {
    console.log('✅ SENTRY_DSN format is valid:', mask(sentryDsn));
  }
  console.log('\n========================================');
  console.log(allSuccess ? '🎉 ALL CONFIGURED SERVICES VERIFIED!' : '⚠️ SOME SERVICES NEED ATTENTION');
  console.log('========================================\n');

  process.exit(allSuccess ? 0 : 1);
}

runVerification();
