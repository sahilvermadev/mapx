/**
 * Script to sync service categories with the comprehensive categories list
 * This updates existing categories and adds new ones
 */

const { Pool } = require('pg');

// Environment variables are loaded by dotenv/config via -r flag in Makefile
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set. Make sure .env file exists in backend/ directory.');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

const comprehensiveCategories = [
  // ==========================================
  // 1. KIDS, PARENTING & SCHOOLING
  // ==========================================
  { id: 1, slug: 'babysitter', name: 'Babysitter', sort_order: 1 },
  { id: 2, slug: 'newborn-care', name: 'Newborn Care', sort_order: 2 },
  { id: 4, slug: 'pediatric-dentist', name: 'Pediatric Dentist', sort_order: 4 },
  { id: 5, slug: 'daycare', name: 'Daycare', sort_order: 5 },
  { id: 6, slug: 'playschool', name: 'Playschool', sort_order: 6 },
  { id: 7, slug: 'montessori', name: 'Montessori', sort_order: 7 },

  // ==========================================
  // 2. ACADEMIC TUITION & COACHING
  // ==========================================
  { id: 10, slug: 'tutor', name: 'Tutor', sort_order: 10 },
  { id: 11, slug: 'maths-tutor', name: 'Maths Tutor', sort_order: 11 },
  { id: 12, slug: 'science-tutor', name: 'Science Tutor', sort_order: 12 },
  { id: 13, slug: 'english-tutor', name: 'English Tutor', sort_order: 13 },
  { id: 14, slug: 'coding-tutor', name: 'Coding Tutor', sort_order: 14 },
  { id: 15, slug: 'jee-coaching', name: 'JEE Coaching', sort_order: 15 },
  { id: 16, slug: 'olympiad-coaching', name: 'Olympiad Coaching', sort_order: 16 },

  // ==========================================
  // 3. SPORTS COACHING
  // ==========================================
  { id: 20, slug: 'cricket-coach', name: 'Cricket Coach', sort_order: 20 },
  { id: 21, slug: 'badminton-coach', name: 'Badminton Coach', sort_order: 21 },
  { id: 22, slug: 'tennis-coach', name: 'Tennis Coach', sort_order: 22 },
  { id: 23, slug: 'swimming-coach', name: 'Swimming Coach', sort_order: 23 },
  { id: 24, slug: 'football-coach', name: 'Football Coach', sort_order: 24 },
  { id: 25, slug: 'basketball-coach', name: 'Basketball Coach', sort_order: 25 },
  { id: 26, slug: 'skating-coach', name: 'Skating Coach', sort_order: 26 },
  { id: 27, slug: 'chess-coach', name: 'Chess Coach', sort_order: 27 },
  { id: 28, slug: 'table-tennis-coach', name: 'Table Tennis Coach', sort_order: 28 },
  { id: 29, slug: 'karate-coach', name: 'Karate Coach', sort_order: 29 },
  { id: 30, slug: 'gymnastics-coach', name: 'Gymnastics Coach', sort_order: 30 },

  // ==========================================
  // 4. ART, MUSIC & HOBBIES
  // ==========================================
  { id: 35, slug: 'dance-class', name: 'Dance Class', sort_order: 35 },
  { id: 36, slug: 'bharatanatyam', name: 'Bharatanatyam', sort_order: 36 },
  { id: 37, slug: 'music-teacher', name: 'Music Teacher', sort_order: 37 },
  { id: 38, slug: 'guitar-teacher', name: 'Guitar Teacher', sort_order: 38 },
  { id: 39, slug: 'keyboard-teacher', name: 'Piano Teacher', sort_order: 39 },
  { id: 40, slug: 'drawing-teacher', name: 'Drawing Teacher', sort_order: 40 },

  // ==========================================
  // 5. CONSTRUCTION, INTERIORS & RENOVATION
  // ==========================================
  { id: 50, slug: 'civil-contractor', name: 'Civil Contractor', sort_order: 50 },
  { id: 51, slug: 'architect', name: 'Architect', sort_order: 51 },
  { id: 52, slug: 'structural-engineer', name: 'Structural Engineer', sort_order: 52 },
  { id: 53, slug: 'home-contractor', name: 'Home Construction', sort_order: 53 },
  { id: 54, slug: 'villa-contractor', name: 'Villa Builder', sort_order: 54 },
  { id: 55, slug: 'interior-contractor', name: 'Interior Contractor', sort_order: 55 },
  { id: 56, slug: 'modular-kitchen', name: 'Modular Kitchen', sort_order: 56 },
  { id: 57, slug: 'wardrobe-maker', name: 'Wardrobe Maker', sort_order: 57 },
  { id: 58, slug: 'furniture-carpenter', name: 'Furniture Carpenter', sort_order: 58 },
  { id: 59, slug: 'false-ceiling', name: 'False Ceiling', sort_order: 59 },
  { id: 60, slug: 'tile-mason', name: 'Tile Work', sort_order: 60 },
  { id: 61, slug: 'waterproofing', name: 'Waterproofing', sort_order: 61 },
  { id: 62, slug: 'aluminium-fabricator', name: 'Aluminium Windows', sort_order: 62 },
  { id: 63, slug: 'upvc-windows', name: 'UPVC Windows', sort_order: 63 },
  { id: 64, slug: 'grill-work', name: 'Grill Fabricator', sort_order: 64 },

  // ==========================================
  // 6. DAILY HOME & UTILITY SERVICES
  // ==========================================
  { id: 70, slug: 'maid', name: 'Maid', sort_order: 70 },
  { id: 71, slug: 'cook', name: 'Cook', sort_order: 71 },
  { id: 72, slug: 'driver', name: 'Driver', sort_order: 72 },
  { id: 73, slug: 'elder-care', name: 'Elder Care', sort_order: 73 },
  { id: 74, slug: 'plumber', name: 'Plumber', sort_order: 74 },
  { id: 75, slug: 'electrician', name: 'Electrician', sort_order: 75 },
  { id: 76, slug: 'painter', name: 'Painter', sort_order: 76 },
  { id: 77, slug: 'carpenter', name: 'Carpenter', sort_order: 77 },
  { id: 201, slug: 'packers-movers', name: 'Packers & Movers', sort_order: 201 },
  { id: 203, slug: 'tiffin-service', name: 'Tiffin Service', sort_order: 203 },

  // ==========================================
  // 7. HEALTH & MEDICAL SPECIALISTS
  // ==========================================
  { id: 90, slug: 'general-physician', name: 'General Physician', sort_order: 90 },
  { id: 91, slug: 'pediatrician', name: 'Pediatrician', sort_order: 91 },
  { id: 92, slug: 'gynecologist', name: 'Gynecologist', sort_order: 92 },
  { id: 93, slug: 'obstetrician', name: 'Obstetrician', sort_order: 93 },
  { id: 94, slug: 'fertility-specialist', name: 'Fertility Specialist', sort_order: 94 },
  { id: 95, slug: 'dermatologist', name: 'Dermatologist', sort_order: 95 },
  { id: 96, slug: 'trichologist', name: 'Trichologist', sort_order: 96 },
  { id: 97, slug: 'orthopedic', name: 'Orthopedic Doctor', sort_order: 97 },
  { id: 98, slug: 'spine-specialist', name: 'Spine Specialist', sort_order: 98 },
  { id: 99, slug: 'knee-replacement', name: 'Knee Surgeon', sort_order: 99 },
  { id: 100, slug: 'neurologist', name: 'Neurologist', sort_order: 100 },
  { id: 101, slug: 'neurosurgeon', name: 'Neurosurgeon', sort_order: 101 },
  { id: 102, slug: 'cardiologist', name: 'Cardiologist', sort_order: 102 },
  { id: 103, slug: 'heart-surgeon', name: 'Heart Surgeon', sort_order: 103 },
  { id: 104, slug: 'ent', name: 'ENT Specialist', sort_order: 104 },
  { id: 105, slug: 'ophthalmologist', name: 'Eye Specialist', sort_order: 105 },
  { id: 106, slug: 'cataract-surgeon', name: 'Cataract Surgeon', sort_order: 106 },
  { id: 107, slug: 'dentist', name: 'Dentist', sort_order: 107 },
  { id: 108, slug: 'orthodontist', name: 'Orthodontist', sort_order: 108 },
  { id: 109, slug: 'gastroenterologist', name: 'Gastroenterologist', sort_order: 109 },
  { id: 110, slug: 'urologist', name: 'Urologist', sort_order: 110 },
  { id: 111, slug: 'nephrologist', name: 'Nephrologist', sort_order: 111 },
  { id: 112, slug: 'endocrinologist', name: 'Endocrinologist', sort_order: 112 },
  { id: 113, slug: 'diabetologist', name: 'Diabetologist', sort_order: 113 },
  { id: 114, slug: 'psychiatrist', name: 'Psychiatrist', sort_order: 114 },
  { id: 115, slug: 'psychologist', name: 'Psychologist', sort_order: 115 },
  { id: 116, slug: 'child-psychologist', name: 'Child Psychologist', sort_order: 116 },
  { id: 117, slug: 'oncologist', name: 'Oncologist', sort_order: 117 },
  { id: 118, slug: 'pulmonologist', name: 'Pulmonologist', sort_order: 118 },
  { id: 119, slug: 'rheumatologist', name: 'Rheumatologist', sort_order: 119 },
  { id: 120, slug: 'physiotherapist', name: 'Physiotherapist', sort_order: 120 },
  { id: 121, slug: 'speech-therapist', name: 'Speech Therapist', sort_order: 121 },
  { id: 122, slug: 'occupational-therapist', name: 'Occupational Therapist', sort_order: 122 },
  { id: 123, slug: 'home-nurse', name: 'Home Nurse', sort_order: 123 },
  { id: 124, slug: 'maternity-hospital', name: 'Maternity Hospital', sort_order: 124 },
  { id: 125, slug: 'multispeciality-hospital', name: 'Multispecialty Hospital', sort_order: 125 },
  { id: 126, slug: 'diagnostic-lab', name: 'Diagnostic Lab', sort_order: 126 },
  { id: 127, slug: 'ayurvedic-doctor', name: 'Ayurvedic Doctor', sort_order: 127 },
  { id: 128, slug: 'homeopathic-doctor', name: 'Homeopathic Doctor', sort_order: 128 },

  // ==========================================
  // 8. WEDDING, EVENTS & PHOTOGRAPHY
  // ==========================================
  { id: 140, slug: 'wedding-photographer', name: 'Wedding Photographer', sort_order: 140 },
  { id: 141, slug: 'wedding-videographer', name: 'Wedding Videographer', sort_order: 141 },
  { id: 142, slug: 'wedding-planner', name: 'Wedding Planner', sort_order: 142 },
  { id: 143, slug: 'caterer', name: 'Wedding Caterer', sort_order: 143 },
  { id: 144, slug: 'bridal-makeup', name: 'Bridal Makeup Artist', sort_order: 144 },
  { id: 145, slug: 'mehendi', name: 'Mehendi Artist', sort_order: 145 },

  // ==========================================
  // 9. AUTOMOTIVE
  // ==========================================
  { id: 160, slug: 'car-mechanic', name: 'Car Mechanic', sort_order: 160 },
  { id: 161, slug: 'bike-mechanic', name: 'Bike Mechanic', sort_order: 161 },

  // ==========================================
  // 10. FINANCE, LEGAL & PETS
  // ==========================================
  { id: 180, slug: 'ca', name: 'Chartered Accountant', sort_order: 180 },
  { id: 181, slug: 'lawyer', name: 'Lawyer', sort_order: 181 },
  { id: 182, slug: 'real-estate-agent', name: 'Property Broker', sort_order: 182 },
  { id: 200, slug: 'vet', name: 'Veterinarian', sort_order: 200 },
  { id: 202, slug: 'pandit', name: 'Pandit', sort_order: 202 },

  // ==========================================
  // 11. ULTRA-HIGH-NET-WORTH (LUXURY)
  // ==========================================
  { id: 300, slug: 'family-office', name: 'Family Office', sort_order: 300 },
  { id: 301, slug: 'private-banker', name: 'Private Banker', sort_order: 301 },
  { id: 302, slug: 'portfolio-manager', name: 'Portfolio Manager', sort_order: 302 },
  { id: 303, slug: 'alternative-investments', name: 'Alternative Investments', sort_order: 303 },
  { id: 304, slug: 'art-advisor', name: 'Art Advisor', sort_order: 304 },
  { id: 305, slug: 'luxury-real-estate', name: 'Luxury Real Estate', sort_order: 305 },
  { id: 306, slug: 'bespoke-tailor', name: 'Bespoke Tailor', sort_order: 306 },
  { id: 307, slug: 'private-jet-broker', name: 'Private Jet Broker', sort_order: 307 },
  { id: 308, slug: 'yacht-broker', name: 'Yacht Broker', sort_order: 308 },
  { id: 309, slug: 'supercar-dealer', name: 'Supercar Dealer', sort_order: 309 },
  { id: 310, slug: 'vintage-car-restorer', name: 'Vintage Car Restorer', sort_order: 310 },
  { id: 311, slug: 'wine-cellar-advisor', name: 'Wine Advisor', sort_order: 311 },
  { id: 312, slug: 'watch-concierge', name: 'Watch Concierge', sort_order: 312 },
  { id: 313, slug: 'jewellery-concierge', name: 'Jewellery Concierge', sort_order: 313 },
  { id: 314, slug: 'private-chef', name: 'Private Chef', sort_order: 314 },
  { id: 315, slug: 'butler', name: 'Butler', sort_order: 315 },
  { id: 316, slug: 'governess', name: 'Governess', sort_order: 316 },
  { id: 317, slug: 'international-school-advisor', name: 'School Admissions', sort_order: 317 },
  { id: 318, slug: 'ivy-league-consultant', name: 'Ivy League Consultant', sort_order: 318 },
  { id: 319, slug: 'private-security', name: 'Private Security', sort_order: 319 },
  { id: 320, slug: 'armored-vehicle', name: 'Armored Vehicle', sort_order: 320 },
  { id: 321, slug: 'luxury-travel-concierge', name: 'Travel Concierge', sort_order: 321 },
  { id: 322, slug: 'private-island-rental', name: 'Private Island Rental', sort_order: 322 },
  { id: 323, slug: 'helicopter-service', name: 'Helicopter Service', sort_order: 323 },
  { id: 324, slug: 'plastic-surgeon', name: 'Plastic Surgeon', sort_order: 324 },
  { id: 325, slug: 'hair-transplant', name: 'Hair Transplant Surgeon', sort_order: 325 },
  { id: 326, slug: 'anti-aging-clinic', name: 'Anti-Aging Clinic', sort_order: 326 },
  { id: 328, slug: 'trustee', name: 'Estate Lawyer', sort_order: 328 },
  { id: 329, slug: 'succession-planner', name: 'Succession Planner', sort_order: 329 },
  { id: 330, slug: 'philanthropy-advisor', name: 'Philanthropy Advisor', sort_order: 330 },
  { id: 331, slug: 'private-members-club', name: 'Private Members Club', sort_order: 331 },
  { id: 333, slug: 'polo-club', name: 'Polo Club', sort_order: 333 },
  { id: 334, slug: 'horse-breeder', name: 'Horse Breeder', sort_order: 334 },

  // ==========================================
  // 12. HYPER-LOCAL GOVT & PAPERWORK FIXERS
  // ==========================================
  { id: 350, slug: 'rto-agent', name: 'RTO Agent', sort_order: 350 },
  { id: 351, slug: 'property-tax-fixer', name: 'Property Tax Fixer', sort_order: 351 },
  { id: 352, slug: 'revenue-dept-fixer', name: 'Revenue Dept Fixer', sort_order: 352 },
  { id: 353, slug: 'passport-agent', name: 'Passport Agent', sort_order: 353 },
  { id: 354, slug: 'police-verification-fixer', name: 'Police Verification', sort_order: 354 },
  { id: 355, slug: 'electricity-board-fixer', name: 'Electricity Fixer', sort_order: 355 },
  { id: 357, slug: 'liquor-permit', name: 'Liquor License Fixer', sort_order: 357 },

  // ==========================================
  // 13. SENSITIVE & SPECIALIZED SERVICES
  // ==========================================
  { id: 380, slug: 'deaddiction-centre', name: 'De-addiction Centre', sort_order: 380 },
  { id: 381, slug: 'divorce-lawyer', name: 'Divorce Lawyer', sort_order: 381 },
  { id: 382, slug: 'adoption-lawyer', name: 'Adoption Lawyer', sort_order: 382 },
  { id: 383, slug: 'surrogacy-clinic', name: 'Surrogacy & IVF Clinic', sort_order: 383 },
  { id: 384, slug: 'egg-donor', name: 'Egg Donor', sort_order: 384 },
  { id: 385, slug: 'private-detective', name: 'Private Detective', sort_order: 385 },
  { id: 386, slug: 'discreet-abortion', name: 'Abortion Clinic', sort_order: 386 },
  { id: 387, slug: 'old-age-home', name: 'Old-Age Home', sort_order: 387 },

  // ==========================================
  // 14. "LIFE SAVER" / VETTED & TRUSTED SERVICES
  // ==========================================
  { id: 400, slug: '20-year-maid', name: 'Maid', sort_order: 400 },
  { id: 402, slug: 'honest-gold-buyer', name: 'Gold Buyer', sort_order: 402 },
  { id: 403, slug: 'genuine-parts-mechanic', name: 'Mechanic', sort_order: 403 },
  { id: 404, slug: 'trustworthy-driver', name: 'Driver', sort_order: 404 },
  { id: 405, slug: 'honest-contractor', name: 'House Contractor', sort_order: 405 },

  // ==========================================
  // 15. GLOBAL / GREY-AREA / HIGH-LEVEL LIAISON
  // ==========================================
  { id: 450, slug: 'citizenship-broker', name: 'Citizenship Broker', sort_order: 450 },
  { id: 451, slug: 'offshore-company', name: 'Offshore Company', sort_order: 451 },
  { id: 453, slug: 'nd-therapist', name: 'Therapist', sort_order: 453 },
];

async function syncCategories() {
  console.log('🔄 Syncing service categories...\n');

  let updated = 0;
  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  // Check for ID conflicts with user-created categories before starting
  const conflictCheck = await pool.query(
    `SELECT id FROM service_categories 
     WHERE id >= 1000 AND id IN (${comprehensiveCategories.map((_, i) => `$${i + 1}`).join(', ')})`,
    comprehensiveCategories.map(cat => cat.id)
  );

  if (conflictCheck.rows.length > 0) {
    const conflictIds = conflictCheck.rows.map(r => r.id).join(', ');
    console.error(`  ⚠️  Warning: System category IDs conflict with user-created categories: ${conflictIds}`);
    console.error(`  ⚠️  These categories will be skipped to preserve user data.`);
  }

  // Use a transaction for atomicity - all updates succeed or all fail
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    for (const cat of comprehensiveCategories) {
      try {
        // Combined query: get all needed fields in one query
        const checkResult = await client.query(
          'SELECT slug, name, sort_order, is_user_created FROM service_categories WHERE id = $1',
          [cat.id]
        );

        if (checkResult.rows.length > 0) {
          const existing = checkResult.rows[0];
          
          // Skip user-created categories - preserve them
          if (existing.is_user_created) {
            skipped++;
            console.log(`  ⊘ Skipped (user-created): ${cat.name} (ID: ${cat.id})`);
            continue;
          }

          // Category exists and is a system category - check if update needed
          if (
            existing.slug !== cat.slug ||
            existing.name !== cat.name ||
            existing.sort_order !== cat.sort_order
          ) {
            await client.query(
              `UPDATE service_categories 
               SET slug = $1, name = $2, sort_order = $3, updated_at = CURRENT_TIMESTAMP
               WHERE id = $4 AND is_user_created = false`,
              [cat.slug, cat.name, cat.sort_order, cat.id]
            );
            updated++;
            console.log(`  ✓ Updated: ${cat.name} (ID: ${cat.id})`);
          } else {
            skipped++;
          }
        } else {
          // Category doesn't exist - check for ID conflict with user-created categories
          if (cat.id >= 1000) {
            const conflictCheck = await client.query(
              'SELECT id FROM service_categories WHERE id = $1',
              [cat.id]
            );
            if (conflictCheck.rows.length > 0) {
              skipped++;
              console.log(`  ⊘ Skipped (ID conflict with user category): ${cat.name} (ID: ${cat.id})`);
              continue;
            }
          }

          // Insert it as a system category
          await client.query(
            `INSERT INTO service_categories (id, slug, name, is_user_created, sort_order)
             VALUES ($1, $2, $3, false, $4)`,
            [cat.id, cat.slug, cat.name, cat.sort_order]
          );
          inserted++;
          console.log(`  + Inserted: ${cat.name} (ID: ${cat.id})`);
        }
      } catch (error) {
        errors++;
        console.error(`  ✗ Error syncing ${cat.name} (ID: ${cat.id}):`, error);
        // Continue processing other categories even if one fails
      }
    }

    // Commit transaction if all operations succeeded
    await client.query('COMMIT');
    
    console.log(`\n✅ Sync complete!`);
    console.log(`   - Updated: ${updated}`);
    console.log(`   - Inserted: ${inserted}`);
    console.log(`   - Skipped (no changes): ${skipped}`);
    console.log(`   - Errors: ${errors}`);
    console.log(`   - Total processed: ${comprehensiveCategories.length}`);
  } catch (error) {
    // Rollback transaction on fatal error
    await client.query('ROLLBACK');
    console.error('\n❌ Fatal error during sync, transaction rolled back:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run the sync
syncCategories()
  .then(() => {
    console.log('\n🎉 Done!');
    pool.end();
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    pool.end();
    process.exit(1);
  });
