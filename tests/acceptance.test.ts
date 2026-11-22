import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import JSZip from 'jszip';

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'stockforge-acceptance-'));
process.env.DATA_DIR = path.join(tmpRoot, 'data');
process.env.OUTPUT_DIR = path.join(tmpRoot, 'output');

async function main() {
  const { createApp } = await import('../server/app.js');
  const { waitForAnimationBatchCompletion } = await import('../server/animationBatchRunner.js');
  const { probeVideoFile } = await import('../server/qaValidator.js');

  const app = createApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert(address && typeof address === 'object');
  const baseUrl = `http://127.0.0.1:${address.port}`;

  async function reqJson<T>(urlPath: string, init?: RequestInit): Promise<{ status: number; data: T }> {
    const res = await fetch(`${baseUrl}${urlPath}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
    const text = await res.text();
    const data = (text ? JSON.parse(text) : {}) as T;
    return { status: res.status, data };
  }

  async function reqBuffer(urlPath: string, init?: RequestInit): Promise<{ status: number; buffer: Buffer; text: string }> {
    const res = await fetch(`${baseUrl}${urlPath}`, init);
    const arr = await res.arrayBuffer();
    const buffer = Buffer.from(arr);
    return { status: res.status, buffer, text: buffer.toString('utf8') };
  }

  try {
    console.log('--- Running StockForge Animation Studio Acceptance Tests ---');

    // Diagnostics Check
    const diag = await reqJson<any>('/api/diagnostics');
    assert.equal(diag.status, 200);
    assert.equal(diag.data.ffmpegAvailable, true, 'FFmpeg must be installed');
    assert.equal(diag.data.ffprobeAvailable, true, 'FFprobe must be installed');
    assert.equal(diag.data.h264Supported, true, 'libx264 must be supported');
    assert.equal(diag.data.proresAlphaSupported, true, 'ProRes 4444 alpha must be supported');
    assert.equal(diag.data.outputFolders.length, 12, 'All 12 /output folders must exist');
    console.log('[PASS] System Diagnostics & 12-folder /output layout');

    // Test 1 & Test 2: Generate Cursor Click Animation + Verify Real MP4 H.264 Playback
    const cursorRes = await reqJson<any>('/api/animations/create', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Cursor Click Button Demo',
        prompt: 'Animated pointer cursor moves smoothly across canvas and clicks subscribe button',
        category: 'Green Screen Animation',
        animationType: 'cursor_click',
        visualStyle: 'Clean Vector Motion',
        backgroundMode: 'solid',
        resolution: '1920x1080',
        durationSec: 2,
        fps: 24,
        exportFormats: ['mp4_h264', 'mp4_preview', 'gif_preview', 'thumbnail_png', 'svg_animated', 'lottie_json', 'source_zip'],
      }),
    });
    assert.equal(cursorRes.status, 201);
    const cursorProj = cursorRes.data.project;
    assert.equal(cursorProj.status, 'completed');
    assert.equal(cursorProj.qaReport.passed, true);
    assert(cursorProj.qaReport.motionScore > 0.5, 'Cursor animation must exhibit real motion across frames');
    assert.equal(cursorProj.qaReport.blackFrameCount, 0);
    assert.equal(cursorProj.qaReport.emptyFrameCount, 0);

    const mp4Download = await reqBuffer(`/api/animations/${cursorProj.id}/download/mp4_h264`);
    assert.equal(mp4Download.status, 200);
    assert(mp4Download.buffer.length > 5000, 'MP4 H.264 must have non-trivial byte size');
    const mp4Artifact = cursorProj.outputFiles.find((f: any) => f.format === 'mp4_h264');
    const mp4Path = path.join(process.env.OUTPUT_DIR!, mp4Artifact.relativePath);
    const mp4Probe = await probeVideoFile(
      mp4Path,
      'mp4_h264',
      mp4Artifact.filename,
      1920,
      1080,
      24,
      2,
      false
    );
    assert.equal(mp4Probe.valid, true);
    assert.equal(mp4Probe.codecName, 'h264');
    assert.equal(mp4Probe.width, 1920);
    assert.equal(mp4Probe.height, 1080);
    assert(Math.abs(mp4Probe.durationSec - 2) <= 0.25);
    console.log('[PASS] Test 1 & 2: Cursor Click Animation & FFprobe H.264 MP4 Verification');

    // Test 3: SVG + Lottie + Source ZIP Export
    const sourceRes = await reqJson<any>(`/api/animations/${cursorProj.id}/source`);
    assert.equal(sourceRes.status, 200);
    assert(sourceRes.data.svgAnimated.includes('<animateTransform'), 'SMIL SVG must include real <animateTransform> motion');
    assert.equal(sourceRes.data.lottieJson.v, '5.7.4');
    assert(Array.isArray(sourceRes.data.lottieJson.layers) && sourceRes.data.lottieJson.layers.length >= 1);

    const srcZipRes = await reqBuffer(`/api/animations/${cursorProj.id}/download/source_zip`);
    assert.equal(srcZipRes.status, 200);
    const parsedZip = await JSZip.loadAsync(srcZipRes.buffer);
    assert(parsedZip.file('project.json'), 'source ZIP must contain project.json');
    assert(parsedZip.file(`${cursorProj.id}.svg`), `source ZIP must contain ${cursorProj.id}.svg`);
    assert(parsedZip.file(`${cursorProj.id}-lottie.json`), `source ZIP must contain ${cursorProj.id}-lottie.json`);
    console.log('[PASS] Test 3: Editable SMIL SVG, Lottie JSON & Source Project ZIP');

    // Test 4: Transparent Background Animation (ProRes 4444 Alpha + PNG RGBA Sequence)
    const alphaRes = await reqJson<any>('/api/animations/create', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Transparent Rising Smoke',
        prompt: 'Soft rising smoke dispersion wisps on transparent alpha channel',
        category: 'Transparent Background Animation',
        animationType: 'smoke',
        visualStyle: 'Organic Fluid',
        backgroundMode: 'transparent',
        resolution: '1920x1080',
        durationSec: 2,
        fps: 24,
        exportFormats: ['mov_alpha', 'png_sequence', 'mp4_preview', 'thumbnail_png', 'svg_animated', 'source_zip'],
      }),
    });
    assert.equal(alphaRes.status, 201);
    const alphaProj = alphaRes.data.project;
    assert.equal(alphaProj.status, 'completed');
    assert.equal(alphaProj.qaReport.alphaVerified, true, 'Alpha channel must be verified on transparent animation');
    const movArtifact = alphaProj.outputFiles.find((f: any) => f.format === 'mov_alpha');
    assert(movArtifact, 'MOV alpha artifact must be produced');
    const movProbe = alphaProj.qaReport.videoProbes.find((p: any) => p.format === 'mov_alpha');
    assert(movProbe?.hasAlphaChannel, 'ffprobe must verify ProRes 4444 alpha channel');

    const seqRes = await reqBuffer(`/api/animations/${alphaProj.id}/download/png_sequence`);
    assert.equal(seqRes.status, 200);
    const seqZip = await JSZip.loadAsync(seqRes.buffer);
    const pngNames = Object.keys(seqZip.files).filter((n) => n.endsWith('.png'));
    assert.equal(pngNames.length, 48, '2s at 24fps should produce 48 PNG frames in sequence ZIP');
    console.log('[PASS] Test 4: Transparent Background ProRes 4444 Alpha & PNG Sequence ZIP');

    // Test 5: Pure Green Screen #00FF00 Production & Chroma Purity Check
    const gsRes = await reqJson<any>('/api/animations/create', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Green Screen HUD Ring',
        prompt: 'Futuristic HUD telemetry ring overlay on chroma key green screen',
        category: 'Green Screen Animation',
        animationType: 'hud',
        visualStyle: 'Minimal HUD',
        backgroundMode: 'green_screen',
        resolution: '1920x1080',
        durationSec: 2,
        fps: 24,
        exportFormats: ['mp4_h264', 'mp4_preview', 'thumbnail_png', 'svg_animated'],
      }),
    });
    assert.equal(gsRes.status, 201);
    const gsProj = gsRes.data.project;
    assert.equal(gsProj.backgroundColor, '#00FF00');
    assert.equal(gsProj.qaReport.greenScreenVerified, true);
    assert((gsProj.qaReport.greenScreenPurityPct ?? 0) >= 95);
    console.log(`[PASS] Test 5: Pure #00FF00 Green Screen Production (purity ${gsProj.qaReport.greenScreenPurityPct?.toFixed(1)}%)`);

    // Test 6: Project Editing, Color/Keyframe/Duration Update & Re-Render
    const editedLayers = JSON.parse(JSON.stringify(cursorProj.layers));
    editedLayers[0].color = '#F59E0B';
    editedLayers[0].keyframes[editedLayers[0].keyframes.length - 1].time = 3.5;
    editedLayers[0].keyframes[editedLayers[0].keyframes.length - 1].x = 1480;

    const patchRes = await reqJson<any>(`/api/animations/${cursorProj.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        name: 'Cursor Click Edited 3.5s',
        durationSec: 3.5,
        palette: ['#F59E0B', '#3B82F6', '#10B981'],
        layers: editedLayers,
        reRender: true,
        exportFormats: ['mp4_h264', 'mp4_preview', 'thumbnail_png', 'svg_animated'],
      }),
    });
    assert.equal(patchRes.status, 200);
    const updatedProj = patchRes.data.project;
    assert.equal(updatedProj.durationSec, 3.5);
    assert.equal(updatedProj.layers[0].color, '#F59E0B');
    const updatedMp4Probe = updatedProj.qaReport.videoProbes.find((p: any) => p.format === 'mp4_h264');
    assert(updatedMp4Probe && Math.abs(updatedMp4Probe.durationSec - 3.5) <= 0.25, 'Re-rendered MP4 duration must reflect edited 3.5s');
    console.log('[PASS] Test 6: Visual Editor Modification, Save & Re-Render Verification');

    // Test 7: 5-Asset Distinct Batch Production Queue
    const batchRes = await reqJson<any>('/api/animation-batches', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Batch Smoke Test 5x',
        basePrompt: 'Clean corporate business infographic motion element',
        category: 'Business & Technology',
        animationType: 'mixed',
        visualStyle: 'Isometric Tech',
        backgroundMode: 'solid',
        resolution: '1920x1080',
        durationSec: 1.5,
        fps: 24,
        providerSlug: 'procedural',
        model: 'stockforge-procedural-v1',
        requestedCount: 5,
        concurrency: 2,
        exportFormats: ['mp4_preview', 'thumbnail_png', 'svg_animated'],
      }),
    });
    assert.equal(batchRes.status, 201);
    const finishedBatch = await waitForAnimationBatchCompletion(batchRes.data.batch.id, 120000);
    assert(finishedBatch);
    assert.equal(finishedBatch.status, 'completed');
    assert.equal(finishedBatch.completedCount, 5);
    assert.equal(finishedBatch.failedCount, 0);

    const batchProjectsRes = await reqJson<any>(`/api/animations?batchId=${finishedBatch.id}`);
    const batchProjects = batchProjectsRes.data.projects;
    assert.equal(batchProjects.length, 5);
    const uniqueHashes = new Set(batchProjects.map((p: any) => p.projectHash));
    assert.equal(uniqueHashes.size, 5, 'All 5 batch assets must have unique composition hashes');
    console.log('[PASS] Test 7: 5-Asset Distinct Batch Production Queue & Deduplication');

    // Test 8: Valid Adobe Stock & Shutterstock CSV Metadata Export
    const adobeCsvRes = await reqBuffer('/api/animations/export-csv', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform: 'adobe_stock', fileExtension: 'mp4' }),
    });
    assert.equal(adobeCsvRes.status, 200);
    assert(adobeCsvRes.text.includes('Filename,Title,Keywords,Category'));
    assert(!/4k ultra|best seller|trending/i.test(adobeCsvRes.text), 'CSV must not contain spam terms');

    const ssCsvRes = await reqBuffer('/api/animations/export-csv', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform: 'shutterstock', fileExtension: 'mp4' }),
    });
    assert.equal(ssCsvRes.status, 200);
    assert(ssCsvRes.text.includes('Filename,Description,Keywords,Categories,Editorial,Mature'));
    console.log('[PASS] Test 8: Adobe Stock & Shutterstock CSV Metadata Export');

    // Test 9: QA Rejection of Broken / Static Animation & /output/failed Persistence
    const brokenDraftRes = await reqJson<any>('/api/animations/create', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Broken Static Test Project',
        prompt: 'Static broken test',
        category: 'Motion Graphics',
        animationType: 'particles',
        visualStyle: 'Clean Vector Motion',
        backgroundMode: 'solid',
        resolution: '1920x1080',
        durationSec: 1.5,
        fps: 24,
        renderNow: false,
      }),
    });
    const brokenId = brokenDraftRes.data.project.id;
    // Hide all layers so animation renders static empty backdrop -> triggers QA failure!
    const hiddenLayers = brokenDraftRes.data.project.layers.map((l: any) => ({ ...l, visible: false }));
    await reqJson<any>(`/api/animations/${brokenId}`, {
      method: 'PATCH',
      body: JSON.stringify({ layers: hiddenLayers, reRender: false }),
    });
    const brokenRenderRes = await reqJson<any>(`/api/animations/${brokenId}/render`, {
      method: 'POST',
      body: JSON.stringify({ exportFormats: ['mp4_preview', 'thumbnail_png'] }),
    });
    assert.equal(brokenRenderRes.status, 422);
    assert.equal(brokenRenderRes.data.project.status, 'failed');
    assert.equal(brokenRenderRes.data.project.qaReport.passed, false);
    const failedFilePath = path.join(process.env.OUTPUT_DIR!, 'failed', `${brokenId}-qa-report.json`);
    assert.equal(fs.existsSync(failedFilePath), true, 'Failed QA report must be persisted to /output/failed');
    const approveBlockedRes = await reqJson<any>(`/api/animations/${brokenId}/review`, {
      method: 'POST',
      body: JSON.stringify({ reviewStatus: 'approved' }),
    });
    assert.equal(approveBlockedRes.status, 400, 'Approving a QA-failed project must be rejected');
    console.log('[PASS] Test 9: Automated QA Rejection of Static/Broken Asset & Approval Block');

    // Test 10: Persistence & Manual Approval Verification
    const approveOkRes = await reqJson<any>(`/api/animations/${cursorProj.id}/review`, {
      method: 'POST',
      body: JSON.stringify({ reviewStatus: 'approved' }),
    });
    assert.equal(approveOkRes.status, 200);
    assert.equal(approveOkRes.data.project.reviewStatus, 'approved');

    const persistedGet = await reqJson<any>(`/api/animations/${cursorProj.id}`);
    assert.equal(persistedGet.status, 200);
    assert.equal(persistedGet.data.project.name, 'Cursor Click Edited 3.5s');
    assert.equal(persistedGet.data.project.reviewStatus, 'approved');
    console.log('[PASS] Test 10: Persistence & Manual Review Approval Verification');

    console.log('ALL 10 ACCEPTANCE TESTS PASSED SUCCESSFULLY.');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error('ACCEPTANCE TEST FAILED:', err);
  process.exit(1);
});
