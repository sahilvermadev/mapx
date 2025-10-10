import { upsertService } from '../services/serviceDeduplication';
import { areNamesLikelySame, calculateSimilarity } from '../utils/nameSimilarity';

/**
 * Test service deduplication scenarios
 * This file demonstrates various deduplication scenarios
 */

// Test name similarity functions
console.log('=== Testing Name Similarity Functions ===');

const testCases = [
  { name1: 'Ramesh Singh', name2: 'Ramesh Singh', expected: true },
  { name1: 'Ramesh Singh', name2: 'Ramesh S', expected: true },
  { name1: 'Ramesh Singh', name2: 'R Singh', expected: true },
  { name1: 'Ramesh Singh', name2: 'Shyam Singh', expected: false },
  { name1: 'John Doe', name2: 'Jane Doe', expected: false },
  { name1: 'Amit Kumar', name2: 'Amit K', expected: true },
  { name1: 'Rajesh Sharma', name2: 'Rajesh S', expected: true },
  { name1: 'Vijay Kumar', name2: 'Vijay K', expected: true }
];

testCases.forEach(({ name1, name2, expected }) => {
  const result = areNamesLikelySame(name1, name2);
  const similarity = calculateSimilarity(name1, name2);
  console.log(`"${name1}" vs "${name2}": ${result.isSimilar} (expected: ${expected}) - Confidence: ${result.confidence.toFixed(2)}, Similarity: ${similarity.toFixed(2)}`);
});

console.log('\n=== Testing Service Deduplication Scenarios ===');

// Test scenario 1: Same phone, similar names
async function testScenario1() {
  console.log('\n--- Scenario 1: Same phone, similar names ---');
  
  try {
    // First recommendation
    const result1 = await upsertService({
      name: 'Ramesh Singh',
      phone_number: '9910192219',
      service_type: 'painter',
      business_name: 'Ramesh Paint Works'
    });
    
    console.log('First service created:', result1);
    
    // Second recommendation with similar name
    const result2 = await upsertService({
      name: 'Ramesh S',
      phone_number: '9910192219',
      service_type: 'painter',
      business_name: 'Ramesh Paint Works'
    });
    
    console.log('Second service (should be merged):', result2);
    
  } catch (error) {
    console.error('Error in scenario 1:', error);
  }
}

// Test scenario 2: Same phone, different names (conflict)
async function testScenario2() {
  console.log('\n--- Scenario 2: Same phone, different names (conflict) ---');
  
  try {
    // First recommendation
    const result1 = await upsertService({
      name: 'Ramesh Singh',
      phone_number: '9910192219',
      service_type: 'painter'
    });
    
    console.log('First service created:', result1);
    
    // Second recommendation with different name
    const result2 = await upsertService({
      name: 'Shyam Kumar',
      phone_number: '9910192219',
      service_type: 'electrician'
    });
    
    console.log('Second service (conflict detected):', result2);
    
  } catch (error) {
    console.error('Error in scenario 2:', error);
  }
}

// Test scenario 3: Same email, different phone
async function testScenario3() {
  console.log('\n--- Scenario 3: Same email, different phone ---');
  
  try {
    // First recommendation
    const result1 = await upsertService({
      name: 'Amit Kumar',
      email: 'amit.painter@gmail.com',
      phone_number: '9876543210',
      service_type: 'painter'
    });
    
    console.log('First service created:', result1);
    
    // Second recommendation with same email but different phone
    const result2 = await upsertService({
      name: 'Amit K',
      email: 'amit.painter@gmail.com',
      phone_number: '9876543211',
      service_type: 'painter'
    });
    
    console.log('Second service (should be merged by email):', result2);
    
  } catch (error) {
    console.error('Error in scenario 3:', error);
  }
}

// Test scenario 4: New service (no conflicts)
async function testScenario4() {
  console.log('\n--- Scenario 4: New service (no conflicts) ---');
  
  try {
    const result = await upsertService({
      name: 'Vijay Sharma',
      phone_number: '9123456789',
      service_type: 'electrician',
      business_name: 'Vijay Electricals'
    });
    
    console.log('New service created:', result);
    
  } catch (error) {
    console.error('Error in scenario 4:', error);
  }
}

// Run all test scenarios
async function runAllTests() {
  console.log('Starting service deduplication tests...\n');
  
  await testScenario1();
  await testScenario2();
  await testScenario3();
  await testScenario4();
  
  console.log('\n=== All tests completed ===');
}

// Export for use in other test files
export { runAllTests, testScenario1, testScenario2, testScenario3, testScenario4 };

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}
