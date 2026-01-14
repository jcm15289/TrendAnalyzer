import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { action, keywords } = await request.json();

    // Log the webhook call
    const logEntry = {
      timestamp: new Date().toISOString(),
      action: action || 'keywords_updated',
      keywordsCount: keywords ? keywords.length : 0,
      userAgent: request.headers.get('user-agent'),
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')
    };

    // Write to webhook log
    const logPath = path.join(process.cwd(), '..', 'TrendKeywords', 'webhook.log');
    fs.appendFileSync(logPath, JSON.stringify(logEntry) + '\n');

    // Here you can add logic to notify Finscanserver
    // For example, trigger a script or send a notification
    
    // Example: Trigger TrendsRun.pl if keywords changed
    if (action === 'keywords_updated' && keywords) {
      // Option 1: Notify local webhook server (if running)
      try {
        const localWebhookUrl = process.env.LOCAL_WEBHOOK_URL || 'http://localhost:8080';
        await fetch(localWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'keywords_updated',
            source: 'vercel_gui',
            keywords: keywords,
            timestamp: new Date().toISOString()
          })
        });
        console.log('Local webhook server notified');
      } catch (webhookError) {
        console.log('Local webhook server not available (optional):', webhookError);
      }

      // Option 2: Create trigger file for local monitoring
      try {
        const triggerFile = path.join(process.cwd(), '..', 'TrendKeywords', 'keywords-updated.trigger');
        fs.writeFileSync(triggerFile, JSON.stringify({
          action: 'keywords_updated',
          timestamp: new Date().toISOString(),
          keywords: keywords,
          source: 'vercel_gui'
        }));
        console.log('Trigger file created for local monitoring');
      } catch (triggerError) {
        console.log('Could not create trigger file:', triggerError);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Webhook received',
      logged: true
    });

  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Webhook processing failed', 
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
