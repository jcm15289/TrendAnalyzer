#!/usr/bin/env tsx

import { getRedisClient } from '../src/lib/redis';
import fs from 'fs';
import path from 'path';

async function backupKeywordsRedis() {
  console.log('\n💾 Creating backup of keywords in Redis...\n');
  
  try {
    const redis = await getRedisClient();
    if (!redis) {
      console.error('❌ Redis client not available');
      process.exit(1);
    }
    
    // Read keywords data from Redis
    const keywordsDataStr = await redis.get('gui-keywords');
    
    if (!keywordsDataStr) {
      console.log('⚠️  No keywords found in Redis (gui-keywords key)');
      await redis.quit();
      return;
    }
    
    const keywordsData = JSON.parse(keywordsDataStr);
    
    // Create backup directory if it doesn't exist
    const backupDir = path.join(process.cwd(), 'debug', 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    // Create timestamped backup files
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0] + '_' + 
                     new Date().toISOString().replace(/[:.]/g, '-').split('T')[1].split('.')[0];
    
    const jsonBackupPath = path.join(backupDir, `keywords-backup-${timestamp}.json`);
    const txtBackupPath = path.join(backupDir, `keywords-backup-${timestamp}.txt`);
    
    // Save JSON backup (full data structure)
    const backupData = {
      ...keywordsData,
      backedUpAt: new Date().toISOString(),
      backupVersion: '1.0',
    };
    
    fs.writeFileSync(jsonBackupPath, JSON.stringify(backupData, null, 2));
    
    // Save human-readable text backup
    const keywords = keywordsData.keywords || [];
    const keywordSets = keywordsData.keywordSets || [];
    
    const textBackup = [
      'KEYWORDS BACKUP FROM REDIS',
      '==========================',
      `Backup Date: ${new Date().toISOString()}`,
      `Source: Redis key "gui-keywords"`,
      '',
      'SUMMARY',
      '-------',
      `Total Keywords: ${keywords.length}`,
      `Total Keyword Sets: ${keywordSets.length}`,
      `Last Updated: ${keywordsData.lastUpdated || 'unknown'}`,
      `Source: ${keywordsData.source || 'unknown'}`,
      '',
      'KEYWORDS LIST',
      '-------------',
      ...keywords.map((k: string, i: number) => `${(i + 1).toString().padStart(4, ' ')}. ${k}`),
      '',
      'KEYWORD SETS',
      '------------',
      ...keywordSets.map((set: string[], i: number) => {
        return `${(i + 1).toString().padStart(4, ' ')}. [${set.join(', ')}]`;
      }),
    ].join('\n');
    
    fs.writeFileSync(txtBackupPath, textBackup);
    
    // Also create a simple keywords-only file (one per line)
    const keywordsOnlyPath = path.join(backupDir, `keywords-only-${timestamp}.txt`);
    fs.writeFileSync(keywordsOnlyPath, keywords.join('\n') + '\n');
    
    console.log('✅ Backup created successfully!');
    console.log(`\n📁 Backup files:`);
    console.log(`  JSON (full data): ${jsonBackupPath}`);
    console.log(`  Text (readable):  ${txtBackupPath}`);
    console.log(`  Keywords only:    ${keywordsOnlyPath}`);
    console.log(`\n📊 Backup contents:`);
    console.log(`  Keywords: ${keywords.length}`);
    console.log(`  Keyword sets: ${keywordSets.length}`);
    console.log(`  Last updated: ${keywordsData.lastUpdated || 'unknown'}`);
    
    await redis.quit();
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

backupKeywordsRedis().catch(console.error);








