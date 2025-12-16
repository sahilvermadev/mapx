/**
 * Script to sync service categories with the comprehensive categories list
 * This updates existing categories and adds new ones
 */

const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Load environment variables - try multiple paths
const envPaths = [
  path.join(__dirname, '../backend/.env'),
  path.join(__dirname, '../.env'),
  path.join(process.cwd(), '.env'),
];

for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    break;
  }
}

// Also try loading from backend directory if we're running from root
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.join(__dirname, '../backend/.env') });
}

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
  { id: 1, slug: 'babysitter', name: 'Babysitter / Nanny', icon: 'baby', sort_order: 1 },
  { id: 2, slug: 'newborn-care', name: 'Newborn Care / Night Nanny', icon: 'newborn', sort_order: 2 },
  { id: 4, slug: 'pediatric-dentist', name: 'Pediatric Dentist', icon: 'tooth', sort_order: 4 },
  { id: 5, slug: 'daycare', name: 'Daycare / Creche', icon: 'school', sort_order: 5 },
  { id: 6, slug: 'playschool', name: 'Playschool / Preschool', icon: 'abacus', sort_order: 6 },
  { id: 7, slug: 'montessori', name: 'Montessori / Waldorf', icon: 'rainbow', sort_order: 7 },

  // ==========================================
  // 2. ACADEMIC TUITION & COACHING
  // ==========================================
  { id: 10, slug: 'tutor', name: 'Private Tutor (All Subjects)', icon: 'book', sort_order: 10 },
  { id: 11, slug: 'maths-tutor', name: 'Maths Tuition', icon: '1234', sort_order: 11 },
  { id: 12, slug: 'science-tutor', name: 'Physics / Chemistry / Biology', icon: 'microscope', sort_order: 12 },
  { id: 13, slug: 'english-tutor', name: 'English / Grammar / Spoken', icon: 'language', sort_order: 13 },
  { id: 14, slug: 'coding-tutor', name: 'Coding / Robotics for Kids', icon: 'laptop', sort_order: 14 },
  { id: 15, slug: 'jee-coaching', name: 'JEE / NEET Coaching', icon: 'graduation_cap', sort_order: 15 },
  { id: 16, slug: 'olympiad-coaching', name: 'Olympiad / NTSE / IMO Prep', icon: 'trophy', sort_order: 16 },

  // ==========================================
  // 3. SPORTS COACHING
  // ==========================================
  { id: 20, slug: 'cricket-coach', name: 'Cricket Coach / Academy', icon: 'cricket_game', sort_order: 20 },
  { id: 21, slug: 'badminton-coach', name: 'Badminton Coach', icon: 'shuttlecock', sort_order: 21 },
  { id: 22, slug: 'tennis-coach', name: 'Tennis Coach', icon: 'tennis', sort_order: 22 },
  { id: 23, slug: 'swimming-coach', name: 'Swimming Coach', icon: 'swimmer', sort_order: 23 },
  { id: 24, slug: 'football-coach', name: 'Football / Soccer Coach', icon: 'soccer', sort_order: 24 },
  { id: 25, slug: 'basketball-coach', name: 'Basketball Coach', icon: 'basketball', sort_order: 25 },
  { id: 26, slug: 'skating-coach', name: 'Roller Skating Coach', icon: 'roller_skate', sort_order: 26 },
  { id: 27, slug: 'chess-coach', name: 'Chess Coach', icon: 'chess_pawn', sort_order: 27 },
  { id: 28, slug: 'table-tennis-coach', name: 'Table Tennis Coach', icon: 'ping_pong', sort_order: 28 },
  { id: 29, slug: 'karate-coach', name: 'Karate / Martial Arts', icon: 'martial_arts_uniform', sort_order: 29 },
  { id: 30, slug: 'gymnastics-coach', name: 'Gymnastics Coach', icon: 'person_cartwheeling', sort_order: 30 },

  // ==========================================
  // 4. ART, MUSIC & HOBBIES
  // ==========================================
  { id: 35, slug: 'dance-class', name: 'Dance Class (All Styles)', icon: 'dancer', sort_order: 35 },
  { id: 36, slug: 'bharatanatyam', name: 'Bharatanatyam / Classical Dance', icon: 'lotus', sort_order: 36 },
  { id: 37, slug: 'music-teacher', name: 'Music Teacher (Vocal / Instrument)', icon: 'musical_note', sort_order: 37 },
  { id: 38, slug: 'guitar-teacher', name: 'Guitar Teacher', icon: 'guitar', sort_order: 38 },
  { id: 39, slug: 'keyboard-teacher', name: 'Keyboard / Piano Teacher', icon: 'piano', sort_order: 39 },
  { id: 40, slug: 'drawing-teacher', name: 'Drawing / Painting Teacher', icon: 'artist_palette', sort_order: 40 },

  // ==========================================
  // 5. CONSTRUCTION, INTERIORS & RENOVATION
  // ==========================================
  { id: 50, slug: 'civil-contractor', name: 'Civil Contractor / Builder', icon: 'construction', sort_order: 50 },
  { id: 51, slug: 'architect', name: 'Architect', icon: 'blueprint', sort_order: 51 },
  { id: 52, slug: 'structural-engineer', name: 'Structural Engineer', icon: 'bridge', sort_order: 52 },
  { id: 53, slug: 'home-contractor', name: 'Full Home Construction', icon: 'house', sort_order: 53 },
  { id: 54, slug: 'villa-contractor', name: 'Villa / Independent House Builder', icon: 'house_with_garden', sort_order: 54 },
  { id: 55, slug: 'interior-contractor', name: 'Turnkey Interior Contractor', icon: 'frame', sort_order: 55 },
  { id: 56, slug: 'modular-kitchen', name: 'Modular Kitchen Specialist', icon: 'kitchen', sort_order: 56 },
  { id: 57, slug: 'wardrobe-maker', name: 'Wardrobe / Furniture Carpenter', icon: 'closet', sort_order: 57 },
  { id: 58, slug: 'furniture-carpenter', name: 'Custom Furniture Carpenter', icon: 'chair', sort_order: 58 },
  { id: 59, slug: 'false-ceiling', name: 'False Ceiling / POP Work', icon: 'ceiling', sort_order: 59 },
  { id: 60, slug: 'tile-mason', name: 'Tile / Marble / Granite Work', icon: 'brick', sort_order: 60 },
  { id: 61, slug: 'waterproofing', name: 'Waterproofing Specialist', icon: 'droplet', sort_order: 61 },
  { id: 62, slug: 'aluminium-fabricator', name: 'Aluminium Windows / Partitions', icon: 'window', sort_order: 62 },
  { id: 63, slug: 'upvc-windows', name: 'UPVC Windows', icon: 'window', sort_order: 63 },
  { id: 64, slug: 'grill-work', name: 'Grill / Railing Fabricator', icon: 'stairs', sort_order: 64 },

  // ==========================================
  // 6. DAILY HOME & UTILITY SERVICES
  // ==========================================
  { id: 70, slug: 'maid', name: 'Maid / Domestic Help', icon: 'broom', sort_order: 70 },
  { id: 71, slug: 'cook', name: 'Home Cook', icon: 'cooking', sort_order: 71 },
  { id: 72, slug: 'driver', name: 'Full-time / Part-time Driver', icon: 'steering_wheel', sort_order: 72 },
  { id: 73, slug: 'elder-care', name: 'Elder Care / Patient Care', icon: 'older_person', sort_order: 73 },
  { id: 74, slug: 'plumber', name: 'Plumber', icon: 'wrench', sort_order: 74 },
  { id: 75, slug: 'electrician', name: 'Electrician', icon: 'zap', sort_order: 75 },
  { id: 76, slug: 'painter', name: 'House Painter', icon: 'paintbrush', sort_order: 76 },
  { id: 77, slug: 'carpenter', name: 'Repair Carpenter', icon: 'hammer', sort_order: 77 },
  { id: 201, slug: 'packers-movers', name: 'Packers & Movers', icon: 'truck', sort_order: 201 },
  { id: 203, slug: 'tiffin-service', name: 'Tiffin Service', icon: 'lunch_box', sort_order: 203 },

  // ==========================================
  // 7. HEALTH & MEDICAL SPECIALISTS
  // ==========================================
  { id: 90, slug: 'general-physician', name: 'General Physician', icon: 'doctor', sort_order: 90 },
  { id: 91, slug: 'pediatrician', name: 'Pediatrician', icon: 'stethoscope', sort_order: 91 },
  { id: 92, slug: 'gynecologist', name: 'Gynecologist', icon: 'female', sort_order: 92 },
  { id: 93, slug: 'obstetrician', name: 'Obstetrician (Pregnancy)', icon: 'pregnant_woman', sort_order: 93 },
  { id: 94, slug: 'fertility-specialist', name: 'Fertility / IVF Specialist', icon: 'dna', sort_order: 94 },
  { id: 95, slug: 'dermatologist', name: 'Dermatologist (Skin & Hair)', icon: 'face', sort_order: 95 },
  { id: 96, slug: 'trichologist', name: 'Hair Fall / Trichologist', icon: 'hair', sort_order: 96 },
  { id: 97, slug: 'orthopedic', name: 'Orthopedic Doctor', icon: 'bone', sort_order: 97 },
  { id: 98, slug: 'spine-specialist', name: 'Spine Specialist / Surgeon', icon: 'backbone', sort_order: 98 },
  { id: 99, slug: 'knee-replacement', name: 'Knee Replacement Surgeon', icon: 'leg', sort_order: 99 },
  { id: 100, slug: 'neurologist', name: 'Neurologist', icon: 'brain', sort_order: 100 },
  { id: 101, slug: 'neurosurgeon', name: 'Neurosurgeon', icon: 'brain_surgery', sort_order: 101 },
  { id: 102, slug: 'cardiologist', name: 'Cardiologist', icon: 'heart', sort_order: 102 },
  { id: 103, slug: 'heart-surgeon', name: 'Cardiac Surgeon', icon: 'heart_surgery', sort_order: 103 },
  { id: 104, slug: 'ent', name: 'ENT Specialist', icon: 'ear', sort_order: 104 },
  { id: 105, slug: 'ophthalmologist', name: 'Eye Specialist', icon: 'eyes', sort_order: 105 },
  { id: 106, slug: 'cataract-surgeon', name: 'Cataract / Lasik Surgeon', icon: 'eye', sort_order: 106 },
  { id: 107, slug: 'dentist', name: 'Dentist (General & Cosmetic)', icon: 'tooth', sort_order: 107 },
  { id: 108, slug: 'orthodontist', name: 'Braces / Orthodontist', icon: 'braces', sort_order: 108 },
  { id: 109, slug: 'gastroenterologist', name: 'Gastroenterologist', icon: 'stomach', sort_order: 109 },
  { id: 110, slug: 'urologist', name: 'Urologist', icon: 'kidney', sort_order: 110 },
  { id: 111, slug: 'nephrologist', name: 'Nephrologist (Kidney)', icon: 'kidney', sort_order: 111 },
  { id: 112, slug: 'endocrinologist', name: 'Endocrinologist (Thyroid/Diabetes)', icon: 'thyroid', sort_order: 112 },
  { id: 113, slug: 'diabetologist', name: 'Diabetologist', icon: 'syringe', sort_order: 113 },
  { id: 114, slug: 'psychiatrist', name: 'Psychiatrist', icon: 'brain', sort_order: 114 },
  { id: 115, slug: 'psychologist', name: 'Psychologist / Counsellor', icon: 'speaking_head', sort_order: 115 },
  { id: 116, slug: 'child-psychologist', name: 'Child Psychologist', icon: 'child_brain', sort_order: 116 },
  { id: 117, slug: 'oncologist', name: 'Cancer Specialist / Oncologist', icon: 'ribbon', sort_order: 117 },
  { id: 118, slug: 'pulmonologist', name: 'Pulmonologist (Lungs)', icon: 'lungs', sort_order: 118 },
  { id: 119, slug: 'rheumatologist', name: 'Rheumatologist (Arthritis)', icon: 'joint_pain', sort_order: 119 },
  { id: 120, slug: 'physiotherapist', name: 'Physiotherapist', icon: 'person_in_lotus_position', sort_order: 120 },
  { id: 121, slug: 'speech-therapist', name: 'Speech Therapist', icon: 'speaking_head', sort_order: 121 },
  { id: 122, slug: 'occupational-therapist', name: 'Occupational Therapist', icon: 'gear', sort_order: 122 },
  { id: 123, slug: 'home-nurse', name: 'Home Nurse', icon: 'nurse', sort_order: 123 },
  { id: 124, slug: 'maternity-hospital', name: 'Maternity / Delivery Hospital', icon: 'hospital', sort_order: 124 },
  { id: 125, slug: 'multispeciality-hospital', name: 'Multi-Speciality Hospital', icon: 'hospital', sort_order: 125 },
  { id: 126, slug: 'diagnostic-lab', name: 'Diagnostic / Pathology Lab', icon: 'test_tube', sort_order: 126 },
  { id: 127, slug: 'ayurvedic-doctor', name: 'Ayurvedic Doctor', icon: 'herb', sort_order: 127 },
  { id: 128, slug: 'homeopathic-doctor', name: 'Homeopathic Doctor', icon: 'pill', sort_order: 128 },

  // ==========================================
  // 8. WEDDING, EVENTS & PHOTOGRAPHY
  // ==========================================
  { id: 140, slug: 'wedding-photographer', name: 'Wedding Photographer', icon: 'camera', sort_order: 140 },
  { id: 141, slug: 'wedding-videographer', name: 'Wedding Videographer', icon: 'video_camera', sort_order: 141 },
  { id: 142, slug: 'wedding-planner', name: 'Wedding Planner', icon: 'ring', sort_order: 142 },
  { id: 143, slug: 'caterer', name: 'Wedding Caterer', icon: 'chef_hat', sort_order: 143 },
  { id: 144, slug: 'bridal-makeup', name: 'Bridal Makeup Artist', icon: 'lipstick', sort_order: 144 },
  { id: 145, slug: 'mehendi', name: 'Mehendi Artist', icon: 'mendhi', sort_order: 145 },

  // ==========================================
  // 9. AUTOMOTIVE
  // ==========================================
  { id: 160, slug: 'car-mechanic', name: 'Car Mechanic', icon: 'car', sort_order: 160 },
  { id: 161, slug: 'bike-mechanic', name: 'Bike Mechanic', icon: 'motorcycle', sort_order: 161 },

  // ==========================================
  // 10. FINANCE, LEGAL & PETS
  // ==========================================
  { id: 180, slug: 'ca', name: 'Chartered Accountant', icon: 'chart', sort_order: 180 },
  { id: 181, slug: 'lawyer', name: 'Lawyer', icon: 'balance_scale', sort_order: 181 },
  { id: 182, slug: 'real-estate-agent', name: 'Property Broker', icon: 'house', sort_order: 182 },
  { id: 200, slug: 'vet', name: 'Veterinarian', icon: 'paw_prints', sort_order: 200 },
  { id: 202, slug: 'pandit', name: 'Pandit / Priest', icon: 'prayer', sort_order: 202 },

  // ==========================================
  // 11. ULTRA-HIGH-NET-WORTH (LUXURY)
  // ==========================================
  { id: 300, slug: 'family-office', name: 'Family Office / Wealth Manager', icon: 'bank', sort_order: 300 },
  { id: 301, slug: 'private-banker', name: 'Private Banker (Priority/Privée)', icon: 'diamond', sort_order: 301 },
  { id: 302, slug: 'portfolio-manager', name: 'Portfolio Manager / PMS', icon: 'chart_increasing', sort_order: 302 },
  { id: 303, slug: 'alternative-investments', name: 'Alternative Investments (PE/VC)', icon: 'rocket', sort_order: 303 },
  { id: 304, slug: 'art-advisor', name: 'Art Advisor / Gallery', icon: 'frame', sort_order: 304 },
  { id: 305, slug: 'luxury-real-estate', name: 'Ultra-Luxury Real Estate Broker', icon: 'mansion', sort_order: 305 },
  { id: 306, slug: 'bespoke-tailor', name: 'Bespoke Suit Tailor (Savile Row)', icon: 'suit', sort_order: 306 },
  { id: 307, slug: 'private-jet-broker', name: 'Private Jet Charter / Broker', icon: 'jet', sort_order: 307 },
  { id: 308, slug: 'yacht-broker', name: 'Yacht Broker / Charter', icon: 'yacht', sort_order: 308 },
  { id: 309, slug: 'supercar-dealer', name: 'Supercar Dealer (Ferrari, etc.)', icon: 'sports_car', sort_order: 309 },
  { id: 310, slug: 'vintage-car-restorer', name: 'Vintage / Classic Car Restorer', icon: 'classic_car', sort_order: 310 },
  { id: 311, slug: 'wine-cellar-advisor', name: 'Fine Wine Collector Advisor', icon: 'wine', sort_order: 311 },
  { id: 312, slug: 'watch-concierge', name: 'Luxury Watch Concierge', icon: 'watch', sort_order: 312 },
  { id: 313, slug: 'jewellery-concierge', name: 'High Jewellery / Diamond Concierge', icon: 'gem_stone', sort_order: 313 },
  { id: 314, slug: 'private-chef', name: 'Private Chef (Michelin-level)', icon: 'chef', sort_order: 314 },
  { id: 315, slug: 'butler', name: 'British-trained Butler', icon: 'butler', sort_order: 315 },
  { id: 316, slug: 'governess', name: 'Governess (Intl. Educated)', icon: 'teacher', sort_order: 316 },
  { id: 317, slug: 'international-school-advisor', name: 'Intl. School Admissions', icon: 'oxford', sort_order: 317 },
  { id: 318, slug: 'ivy-league-consultant', name: 'Ivy League / Oxbridge Consultant', icon: 'harvard', sort_order: 318 },
  { id: 319, slug: 'private-security', name: 'Close Protection / Private Security', icon: 'bodyguard', sort_order: 319 },
  { id: 320, slug: 'armored-vehicle', name: 'Armored Vehicle Supplier', icon: 'armored_car', sort_order: 320 },
  { id: 321, slug: 'luxury-travel-concierge', name: 'Luxury Travel Concierge', icon: 'private_jet', sort_order: 321 },
  { id: 322, slug: 'private-island-rental', name: 'Private Island / Villa Rental', icon: 'island', sort_order: 322 },
  { id: 323, slug: 'helicopter-service', name: 'Private Helicopter Service', icon: 'helicopter', sort_order: 323 },
  { id: 324, slug: 'plastic-surgeon', name: 'Top Plastic / Cosmetic Surgeon', icon: 'scalpel', sort_order: 324 },
  { id: 325, slug: 'hair-transplant', name: 'Celebrity Hair Transplant Surgeon', icon: 'hair', sort_order: 325 },
  { id: 326, slug: 'anti-aging-clinic', name: 'Anti-Aging / Longevity Clinic', icon: 'dna', sort_order: 326 },
  { id: 328, slug: 'trustee', name: 'Private Trust & Estate Lawyer', icon: 'will', sort_order: 328 },
  { id: 329, slug: 'succession-planner', name: 'Family Succession Planner', icon: 'family_tree', sort_order: 329 },
  { id: 330, slug: 'philanthropy-advisor', name: 'Philanthropy Advisor', icon: 'heart_hands', sort_order: 330 },
  { id: 331, slug: 'private-members-club', name: "Private Members' Club Referral", icon: 'crown', sort_order: 331 },
  { id: 333, slug: 'polo-club', name: 'Polo Club Referral', icon: 'horse', sort_order: 333 },
  { id: 334, slug: 'horse-breeder', name: 'Thoroughbred Horse Breeder', icon: 'horse_racing', sort_order: 334 },

  // ==========================================
  // 12. HYPER-LOCAL GOVT & PAPERWORK FIXERS
  // ==========================================
  { id: 350, slug: 'rto-agent', name: 'RTO Agent / Paperwork Fixer', icon: 'license', sort_order: 350 },
  { id: 351, slug: 'property-tax-fixer', name: 'Property Tax / Mutation Fixer', icon: 'stamp', sort_order: 351 },
  { id: 352, slug: 'revenue-dept-fixer', name: 'Revenue Dept / Land Records Fixer', icon: 'document', sort_order: 352 },
  { id: 353, slug: 'passport-agent', name: 'Tatkal / Urgent Passport Agent', icon: 'passport', sort_order: 353 },
  { id: 354, slug: 'police-verification-fixer', name: 'Police Verification / Clearance', icon: 'badge', sort_order: 354 },
  { id: 355, slug: 'electricity-board-fixer', name: 'Electricity Board Fixer', icon: 'bolt', sort_order: 355 },
  { id: 357, slug: 'liquor-permit', name: 'Liquor License / Permit Fixer', icon: 'wine', sort_order: 357 },

  // ==========================================
  // 13. SENSITIVE & SPECIALIZED SERVICES
  // ==========================================
  { id: 380, slug: 'deaddiction-centre', name: 'Alcohol / Drug De-addiction Centre', icon: 'broken_heart', sort_order: 380 },
  { id: 381, slug: 'divorce-lawyer', name: 'Divorce Lawyer (Fast Settlement)', icon: 'gavel', sort_order: 381 },
  { id: 382, slug: 'adoption-lawyer', name: 'Adoption Lawyer / Facilitator', icon: 'family', sort_order: 382 },
  { id: 383, slug: 'surrogacy-clinic', name: 'Ethical Surrogacy & IVF Clinic', icon: 'pregnant_woman', sort_order: 383 },
  { id: 384, slug: 'egg-donor', name: 'Egg Donor (Screened)', icon: 'dna', sort_order: 384 },
  { id: 385, slug: 'private-detective', name: 'Private Detective', icon: 'magnifying_glass', sort_order: 385 },
  { id: 386, slug: 'discreet-abortion', name: 'Safe & Discreet Abortion Clinic', icon: 'hushed', sort_order: 386 },
  { id: 387, slug: 'old-age-home', name: 'Premium Old-Age Home', icon: 'home', sort_order: 387 },

  // ==========================================
  // 14. "LIFE SAVER" / VETTED & TRUSTED SERVICES
  // ==========================================
  { id: 400, slug: '20-year-maid', name: 'Loyal Maid / Cook (20+ Years)', icon: 'broom', sort_order: 400 },
  { id: 402, slug: 'honest-gold-buyer', name: 'Honest Gold Buyer (Fair Rate)', icon: 'gold', sort_order: 402 },
  { id: 403, slug: 'genuine-parts-mechanic', name: 'Mechanic (100% Genuine Parts)', icon: 'wrench', sort_order: 403 },
  { id: 404, slug: 'trustworthy-driver', name: 'Trustworthy Driver (Vetted)', icon: 'steering_wheel', sort_order: 404 },
  { id: 405, slug: 'honest-contractor', name: 'Honest Builder (On Time)', icon: 'construction', sort_order: 405 },

  // ==========================================
  // 15. GLOBAL / GREY-AREA / HIGH-LEVEL LIAISON
  // ==========================================
  { id: 450, slug: 'citizenship-broker', name: 'Citizenship by Investment', icon: 'passport', sort_order: 450 },
  { id: 451, slug: 'offshore-company', name: 'Offshore Company Setup', icon: 'island', sort_order: 451 },
  { id: 453, slug: 'nd-therapist', name: 'Therapist (Strict NDA)', icon: 'lock', sort_order: 453 },
];

async function syncCategories() {
  console.log('🔄 Syncing service categories...\n');

  let updated = 0;
  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  for (const cat of comprehensiveCategories) {
    try {
      // Check if category exists first
      const checkResult = await pool.query(
        'SELECT slug, name, icon, sort_order FROM service_categories WHERE id = $1',
        [cat.id]
      );

      if (checkResult.rows.length > 0) {
        // Category exists - check if update needed
        const existing = checkResult.rows[0];
        if (
          existing.slug !== cat.slug ||
          existing.name !== cat.name ||
          existing.icon !== cat.icon ||
          existing.sort_order !== cat.sort_order
        ) {
          await pool.query(
            `UPDATE service_categories 
             SET slug = $1, name = $2, icon = $3, sort_order = $4, updated_at = CURRENT_TIMESTAMP
             WHERE id = $5`,
            [cat.slug, cat.name, cat.icon, cat.sort_order, cat.id]
          );
          updated++;
          console.log(`  ✓ Updated: ${cat.name} (ID: ${cat.id})`);
        } else {
          skipped++;
        }
      } else {
        // Category doesn't exist - insert it
        await pool.query(
          `INSERT INTO service_categories (id, slug, name, icon, sort_order)
           VALUES ($1, $2, $3, $4, $5)`,
          [cat.id, cat.slug, cat.name, cat.icon, cat.sort_order]
        );
        inserted++;
        console.log(`  + Inserted: ${cat.name} (ID: ${cat.id})`);
      }
    } catch (error) {
      errors++;
      console.error(`  ✗ Error syncing ${cat.name} (ID: ${cat.id}):`, error);
    }
  }

  console.log(`\n✅ Sync complete!`);
  console.log(`   - Updated: ${updated}`);
  console.log(`   - Inserted: ${inserted}`);
  console.log(`   - Skipped (no changes): ${skipped}`);
  console.log(`   - Errors: ${errors}`);
  console.log(`   - Total processed: ${comprehensiveCategories.length}`);
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








