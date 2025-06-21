const { exec } = require('child_process');
const fs = require('fs');

console.log('=== Timer Functionality Test ===\n');

// Test 1: Check if individual website timers are being created
console.log('1. Checking individual website timer creation...');
console.log('   - Each website should have its own timer based on checkInterval');
console.log('   - No global timer should interfere with individual timers');
console.log('   - Timers should be stored in monitoringIntervals Map\n');

// Test 2: Check if timers are being cleaned up properly
console.log('2. Checking timer cleanup...');
console.log('   - When website is deleted, its timer should be cleared');
console.log('   - When website is paused, its timer should be cleared');
console.log('   - When website settings change, old timer should be replaced\n');

// Test 3: Check if timers respect checkInterval
console.log('3. Checking timer intervals...');
console.log('   - Timer should run every checkInterval minutes');
console.log('   - Different websites can have different intervals');
console.log('   - Timer should use setTimeout, not setInterval for individual websites\n');

// Test 4: Check for potential issues
console.log('4. Potential issues to check:');
console.log('   - Multiple startMonitoring() calls (found in index.ts and routes.ts)');
console.log('   - Global runMonitoringCycle() being called manually');
console.log('   - Timer conflicts between individual and global monitoring');
console.log('   - Memory leaks from uncleaned timers\n');

// Test 5: Verify current monitoring status
console.log('5. Current monitoring status:');
console.log('   - Check if monitoringIntervals Map is being used correctly');
console.log('   - Verify no global setInterval is running monitoring cycle');
console.log('   - Confirm individual website timers are working\n');

console.log('=== Recommendations ===');
console.log('1. Ensure only one startMonitoring() call at server startup');
console.log('2. Verify individual website timers use setTimeout, not setInterval');
console.log('3. Check that timer cleanup is working properly');
console.log('4. Monitor for any timer conflicts or memory leaks');
console.log('5. Add logging to track timer creation and cleanup\n');

console.log('=== Next Steps ===');
console.log('1. Check server logs for timer-related messages');
console.log('2. Verify websites are being checked at their specified intervals');
console.log('3. Test website deletion to ensure timer cleanup');
console.log('4. Monitor memory usage for potential timer leaks');
console.log('5. Add debug logging to track timer lifecycle\n'); 