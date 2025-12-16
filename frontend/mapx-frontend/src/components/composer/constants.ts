/**
 * Constants for RecommendationComposer and related components
 * Centralized location for all constant values used across the composer
 */

// ============================================================================
// Content Types
// ============================================================================

export const CONTENT_TYPES = {
  PLACE: 'place',
  SERVICE: 'service',
  UNCLEAR: 'unclear',
} as const;

export type ContentType = typeof CONTENT_TYPES[keyof typeof CONTENT_TYPES];

// Question content type options for category selection
export const QUESTION_CONTENT_TYPES = [
  { key: CONTENT_TYPES.PLACE, label: 'Places' },
  { key: CONTENT_TYPES.SERVICE, label: 'Services' },
] as const;

// ============================================================================
// Field Names
// ============================================================================

export const FIELDS = {
  NAME: 'name',
  DESCRIPTION: 'description',
  LOCATION: 'location',
  CONTACT_INFO: 'contact_info',
  HIGHLIGHTS: 'highlights',
  RATING: 'rating',
  CATEGORY: 'category',
  PRICING: 'pricing',
  EXPERIENCE: 'experience',
  LABELS: 'labels',
} as const;

// ============================================================================
// Celebration Animation Constants
// ============================================================================

export const CELEBRATION_DELAY_MS = 1800;
export const CELEBRATION_SHAPES_COUNT = 12;
export const CELEBRATION_SHAPE_RADIUS = 100;
export const CELEBRATION_SHAPE_SIZE_MIN = 12;
export const CELEBRATION_SHAPE_SIZE_MAX = 28;
export const CELEBRATION_SHAPE_COLORS = ['#000', '#fbbf24', '#ef4444'] as const;

// ============================================================================
// Preview Step Constants
// ============================================================================

export const PREVIEW_DEBOUNCE_MS = 1000;
export const PREVIEW_FALLBACK_TIMEOUT_MS = 25000;

// ============================================================================
// Error Messages
// ============================================================================

export const ERROR_MESSAGES = {
  SAVE_ERROR: 'Sorry, there was an error saving your recommendation. Please try again.',
  SAVE_FAILED: 'Failed to save recommendation',
} as const;

// ============================================================================
// Success Messages
// ============================================================================

export const SUCCESS_MESSAGES = {
  POSTED: 'Recommendation posted!',
} as const;

// ============================================================================
// Re-export step-specific constants
// ============================================================================

export {
  RATING_MESSAGES,
  MAX_VISIBLE_LABELS,
  MAX_LABEL_LENGTH,
  MIN_PLACE_NAME_INPUT_WIDTH,
  PLACE_NAME_INPUT_PADDING,
  INPUT_STYLE_PROPS,
  INPUT_CLASSES,
} from './steps/constants';

// ============================================================================
// Curated Labels
// ============================================================================

/**
 * Curated labels organized by category for place recommendations
 * These labels help users categorize and tag their recommendations
 */
export const CURATED_LABELS = {
  'Atmosphere & Vibe': [
    'Atmosphere',
    'Good Music',
    'Live Music',
    'Dancing',
    'Romantic',
    'Hidden Gem',
    'Speakeasy',
  ],
  'Occasions & Groups': [
    'Afternoon Tea',
    'After Work',
    'Birthdays',
    'Brunch',
    'Business Lunch',
    'Casual Dinner',
    'Date Night',
    'First Date',
    "Girl's Night",
    'Hangover',
    'Happy Hour',
    'Large Group (8+)',
    'Lunch',
    'Night Out',
    'Parents',
    'Pre-Theatre',
    'Private Events',
    'Quick Bite',
    'Solo Dining',
    'Special Occasion',
    'Visitors',
  ],
  'Food & Drink Details': [
    'AYCE (All You Can Eat)',
    'Beer',
    'Bottomless Brunch',
    'Breakfast',
    'BYOB (Bring Your Own Bottle)',
    'Cocktails',
    'Coffee',
    'Dessert',
    'Large Portions',
    'Mocktails',
    'Small Plates',
    'Tasting Menu',
    'Wine List',
  ],
  'Dietary & Cuisine': [
    'Gluten Free',
    'Halal',
    'Healthy',
    'Vegans',
    'Vegetarians',
  ],
  'Service & Logistics': [
    'Delivery',
    'Last-Minute Res (Reservation)',
    'National Shipping',
    'Takeout',
    'Walk-ins',
    'Walk-in Only',
    'Working',
  ],
  'Features & Amenities': [
    'Cash Only',
    'Dog Friendly',
    'Kid Friendly',
    'Karaoke',
    'LGBTQ+',
    'Photos',
    'Rooftop',
    'Sharing',
    'Sports / TVs',
    'Trivia',
    'Views',
    'Outdoor Seating',
    'On the Water',
  ],
  'General Impressions': [
    'Cheap Eats',
    'Fine Dining',
    'Great Service',
  ],
  'What was wrong?': [
    'Bad Ambiance',
    'Bad Music',
    'Too Crowded',
    'Too Loud',
    'Tourist-y',
    'Bad Food',
    'Small Portions',
    'Unhealthy',
    'Unsanitary',
    'Traveled Badly',
    'Bad Service',
    'Hard to Park',
    'Hard To Reserve',
    'Limited Options',
    'Limited Seating',
    'Long Wait',
    'Expensive',
    'Overpriced',
    'Overrated',
  ],
} as const;

export const SERVICE_CURATED_LABELS = {
  // ── 1. Babysitter / Nanny ─────────────────────
  babysitter: {
    'Availability & Role': [
      'Full-time',
      'Part-time',
      'Live-in',
      'Live-out',
      'Night shifts OK',
      'Emergency available',
      'Weekend OK',
      'Can travel with family',
    ],
    'Age Expertise': [
      'Newborn expert',
      'Good with 0–2 years',
      'Good with toddlers',
      'Good with school kids',
      'Twin experience',
      'Handles tantrums well',
    ],
    'Daily Skills': [
      'Cooks healthy meals',
      'North/South Indian cooking',
      'Feeds without fuss',
      'Gives bath & massage',
      'Potty training help',
      'Helps with homework',
      'Drives kids to classes',
      'Speaks English',
    ],
    'Personality & Trust': [
      'Treats child like own',
      'Super loving & patient',
      'Strict but fair',
      'Calm during crying',
      'Trustworthy with keys',
      'Police verified',
      'Long-term (2+ years)',
      'Family background known',
      'References available',
    ],
    'Parent Life-Saver': [
      'Mom finally gets sleep',
      'Handles sick days',
      'No phone addiction',
      'Follows routine strictly',
      'Sends photos/updates',
    ],
    'What was wrong?': [
      'Frequently late',
      'Too much phone',
      'Doesn’t follow instructions',
      'Rough with child',
      'Changes every few months',
      'Takes too many leaves',
    ],
  },

  // ── 2. Newborn Care / Night Nanny ─────────────
  'newborn-care': {
    'Core Expertise': [
      'Night nanny',
      'Sleep training pro',
      'Lactation support',
      'Burping & soothing expert',
      'Cord care & massage',
      'Postpartum doula',
    ],
    'Safety & Training': [
      'Hospital trained',
      'CPR certified',
      'Vaccinated',
      'Police verified',
      'Gentle handling',
    ],
    'Mom Support': [
      'Lets mom sleep 6+ hrs',
      'Light housework',
      'Emotional support',
      'Helps establish routine',
      'Teaches breastfeeding',
    ],
    'Trust Signals': [
      'Worked with 10+ families',
      'References from doctors',
      'Stayed 3–6 months',
      'No crying left unattended',
    ],
    'Red Flags': [
      'Falls asleep on duty',
      'Rough swaddling',
      'Doesn’t wake for feeds',
      'Uses phone all night',
    ],
  },

  // ── 3. Pediatric Dentist ──────────────────────
  'pediatric-dentist': {
    'Child Experience': [
      'Zero tears',
      'Super gentle',
      'Good with scared kids',
      'Explains in kid language',
      'Play area in clinic',
      'TV/cartoon during procedure',
      'Reward sticker system',
    ],
    'Treatment Approach': [
      'No unnecessary fillings',
      'Honest diagnosis',
      'Painless injections',
      'Doesn’t force braces early',
      'Waits for baby teeth to fall',
    ],
    'Parent Experience': [
      'Short waiting time',
      'Explains everything',
      'Reasonable fees',
      'Follow-up calls',
      'Emergency available',
    ],
    'Red Flags': [
      'Pushes expensive treatments',
      'Long waiting',
      'Rude staff',
      'Scolds child',
      'Does root canal on milk teeth',
    ],
  },

  // ── 4. Daycare / Creche ───────────────────────
  daycare: {
    'Safety & Hygiene': [
      '24×7 CCTV',
      'Clean toilets',
      'Safe play area',
      'Vaccinated staff',
      'Daily temperature check',
      'Separate nap room',
    ],
    'Food & Care': [
      'Homemade food',
      'No junk',
      'Handles allergies',
      'Proper nap schedule',
      'Loving teachers',
    ],
    'Activities': [
      'Learning through play',
      'Music & movement',
      'Story time',
      'Outdoor play',
      'Art & craft',
      'Celebrates birthdays',
    ],
    'Parent Convenience': [
      'Flexible timings',
      'Half-day option',
      'Pickup/drop available',
      'Daily photos & updates',
      'Sick day policy fair',
    ],
    'Red Flags': [
      'Too many kids per teacher',
      'Dirty premises',
      'Frequent illness',
      'No CCTV',
      'Rude owner',
    ],
  },

  // ── 5. Playschool / Preschool ─────────────────
  playschool: {
    'Teaching Method': [
      'Pure Montessori',
      'Play-way method',
      'Waldorf/Steiner',
      'Reggio Emilia',
      'Academic focus',
      'Balanced approach',
    ],
    'Skill Development': [
      'Strong phonics',
      'Good handwriting',
      'Confident speaking',
      'Creative & artistic',
      'Social skills',
      'Disciplined yet happy',
    ],
    'Facilities': [
      'Beautiful classroom',
      'Outdoor play area',
      'Library corner',
      'AC rooms',
      'Safe transport',
    ],
    'Parent Involvement': [
      'Regular parent-teacher meets',
      'Daily app updates',
      'Events & performances',
      'Open door policy',
    ],
    'Red Flags': [
      'Too much worksheet',
      'Corporal punishment',
      'Overcrowded',
      'No outdoor space',
      'Frequent teacher change',
    ],
  },

  // ── 6. Montessori / Waldorf ───────────────────
  montessori: {
    'Authenticity': [
      'AMI/AMS trained teachers',
      'Pure Montessori materials',
      '3-hour work cycle',
      'Mixed age group',
      'Child-led learning',
      'No rewards/punishment',
    ],
    'Outcomes': [
      'Independent child',
      'Loves learning',
      'Excellent concentration',
      'Practical life skills',
      'Grace & courtesy',
    ],
    'Environment': [
      'Prepared environment',
      'Beautiful classroom',
      'Nature-based',
      'Limited screen time',
      'Celebrates festivals meaningfully',
    ],
    'Parent Fit': [
      'Parent education sessions',
      'Respectful community',
      'No pressure for early reading',
    ],
    'Red Flags': [
      'Just a name board',
      'Worksheets in Montessori',
      'Teacher shouting',
      'Plastic toys only',
    ],
  },

  // ── 10. Private Tutor (All Subjects) ─────────────────────
  tutor: {
    'Teaching Style': [
      'Concept clarity master',
      'Exam-oriented',
      'Super patient',
      'Strict & disciplined',
      'Fun learning',
      'Regular tests',
      'Gives personal attention',
      'Makes child love the subject',
    ],
    'Results & Track Record': [
      'Score improved 25%+',
      'From fail to 90+',
      'Many 95+ scorers',
      'Consistent A+',
      'Weak student specialist',
    ],
    'Availability & Mode': [
      'Home tuition',
      'Online classes',
      'Group of 3–5',
      'Early morning batch',
      'Weekend batch',
      'Summer crash course',
      'Takes only 1–2 students',
    ],
    'Parent Experience': [
      'Regular parent updates',
      'Shares daily progress',
      'Flexible with timings',
      'Adjusts during exams',
      'Gives notes & PYQs',
    ],
    'What was wrong?': [
      'Takes too many students',
      'Cancels classes often',
      'Only teaches formula',
      'No concept building',
      'Just dictates notes',
      'Too expensive',
    ],
  },

  // ── 11. Maths Tutor ─────────────────────────────────────
  'maths-tutor': {
    'Level & Boards': [
      'CBSE', 'ICSE', 'IB', 'IGCSE', 'State Board',
      'Class 8–10', 'Class 11–12', 'JEE level',
    ],
    'Special Strength': [
      'Algebra beast',
      'Geometry & Mensuration pro',
      'Trigonometry made easy',
      'Calculus expert',
      'Simplifies RD Sharma',
      'Teaches shortcuts & tricks',
      'Vedic Maths',
    ],
    'Results': [
      'From 40 to 95 in 6 months',
      '100/100 in boards',
      'Many school toppers',
      'JEE Maths 90+',
    ],
    'Style': [
      'Builds from basics',
      'Lots of practice',
      'Daily homework',
      'Weekly tests',
      'Error analysis',
    ],
  },

  // ── 12. Science Tutor (Physics / Chem / Bio) ─────────────
  'science-tutor': {
    'Subject Focus': [
      'Physics expert',
      'Chemistry wizard',
      'Biology diagram king',
      'All three sciences',
      'NCERT at fingertips',
    ],
    'Teaching Magic': [
      'Real-life examples',
      'Mind maps & flowcharts',
      'Makes reactions easy',
      'Loves practicals',
      'Teaches numericals step-by-step',
      'Memory techniques',
    ],
    'Board & Competitive': [
      'CBSE/ICSE boards',
      'NEET Biology',
      'JEE Physics/Chemistry',
      'Olympiad level',
    ],
    'Red Flags': [
      'Just reads textbook',
      'No practical explanation',
      'Skips derivations',
      'Too fast',
    ],
  },

  // ── 13. English Tutor (Grammar / Spoken / Literature) ────
  'english-tutor': {
    'Focus Area': [
      'Grammar & writing',
      'Spoken English',
      'Reading comprehension',
      'Literature (ICSE/CBSE)',
      'Essay & letter writing',
      'Vocabulary builder',
    ],
    'Student Type': [
      'Weak in English',
      'School topper polishing',
      'Convent school level',
      'IELTS/TOEFL prep',
      'Public speaking',
    ],
    'Style': [
      'Corrects every mistake',
      'Daily speaking practice',
      'Story telling method',
      'Debate & GD',
      'British/American accent',
    ],
    'Results': [
      'From 50s to 90s',
      'Lost fear of English',
      'Confident in school',
      'Won elocution prizes',
    ],
  },

  // ── 14. Coding / Robotics for Kids ─────────────────────
  'coding-tutor': {
    'Curriculum & Tools': [
      'Scratch',
      'Python',
      'App development',
      'Robotics & Arduino',
      'MIT App Inventor',
      'Game development',
      'AI & ML basics',
    ],
    'Age Group': [
      'Class 3–5',
      'Class 6–8',
      'Class 9+',
      'Girls-only batch',
    ],
    'Outcome': [
      'Made own game',
      'Won Hackathon',
      'Built working robot',
      'Published app',
      'Loves logical thinking',
    ],
    'Style': [
      'Project-based',
      'Super fun classes',
      'No rote learning',
      'Competition prep',
    ],
  },

  // ── 15. JEE / NEET Coaching ─────────────────────────────
  'jee-coaching': {
    'Track Record': [
      'Rank under 1000',
      'Rank under 5000',
      'IIT Bombay/CSE selections',
      'AIIMS Delhi',
      'Many 99.9+ percentile',
      'Repeaters turned rankers',
    ],
    'Faculty': [
      'Ex-IITian',
      'Kota superstar',
      '30+ years experience',
      'Author of books',
      'DPP & module maker',
    ],
    'System': [
      'Daily DPPs',
      'Fortnightly tests',
      'Star batch',
      'One-to-one doubt clearing',
      'Motivational sessions',
      'Parent-teacher meetings',
    ],
    'Batch Type': [
      'Foundation (Class 9–10)',
      '2-year regular',
      '1-year droppers',
      'Crash course',
      'Online live',
    ],
    'Red Flags': [
      'Too many students (200+)',
      'No personal attention',
      'Fake rank claims',
      'Only theory, no tests',
    ],
  },

  // ── 16. Olympiad / NTSE / IMO / NSO Prep ─────────────────
  'olympiad-coaching': {
    'Exams Covered': [
      'IMO', 'NSO', 'IEO', 'NSTSE',
      'NTSE Stage 1 & 2', 'RMO/INMO', 'IOQM',
      'Science Olympiad', 'Cyber Olympiad',
    ],
    'Achievements': [
      'International rank',
      'State rank 1',
      'Gold medalist maker',
      'Many PRMO qualifiers',
      'KVPY scholar',
    ],
    'Teaching Style': [
      'Advanced problem solving',
      'Teaches thinking',
      'Short tricks',
      'Previous year papers',
      'Mock Olympiads',
    ],
    'Student Fit': [
      'Already 95%+ in school',
      'Loves challenging questions',
      'Wants scholarship',
    ],
  },

  // ── 20. Cricket Coach / Academy ─────────────────────
  'cricket-coach': {
    'Coach Background': [
      'Played Ranji',
      'State-level player',
      'District captain',
      'BCCI Level 2 certified',
      'Ex-club cricketer',
    ],
    'Specialization': [
      'Batting specialist',
      'Fast bowling expert',
      'Spin bowling',
      'Wicket-keeping',
      'Fielding & fitness',
      'Mental toughness training',
    ],
    'Facilities & Setup': [
      'Turf wickets',
      'Bowling machine',
      'Video analysis',
      'Night practice with floodlights',
      'Proper ground + nets',
    ],
    'Age & Results': [
      'Under-13 selections',
      'Under-16 district',
      'Many club players',
      'T20 tournament winners',
      'Builds proper technique',
    ],
    'Parent Experience': [
      'Disciplined environment',
      'Punctual batches',
      'Regular matches',
      'No favoritism',
      'Good behavior on field',
    ],
    'Red Flags': [
      'Only money-minded',
      'No proper ground',
      'Too many kids per net',
      'No matches, only nets',
    ],
  },

  // ── 21. Badminton Coach ─────────────────────────────
  'badminton-coach': {
    'Coach Level': [
      'State player',
      'National rank holder',
      'Played for India juniors',
      'Certified NIS coach',
    ],
    'Training Style': [
      'Footwork king',
      'Smash & drop specialist',
      'Doubles tactics',
      'Multi-shuttle drills',
      'Tournament prep',
    ],
    'Court & Setup': [
      'Wooden courts',
      'Yonex mats',
      '4+ courts',
      'AC hall',
      'Proper lighting',
    ],
    'Results': [
      'State rankers',
      'District champions',
      'Won Yonex-Sunrise',
      'School nationals medal',
    ],
  },

  // ── 22. Tennis Coach ───────────────────────────────
  'tennis-coach': {
    'Coach Pedigree': [
      'Played nationals',
      'AITA ranked',
      'ITF certified',
      'Ex-Davis Cup camp',
    ],
    'Court Type': [
      'Clay court',
      'Synthetic',
      'Cement',
      'Floodlit',
    ],
    'Focus': [
      'Baseline game',
      'Serve & volley',
      'Topspin forehand',
      'One-handed backhand',
      'Mental game',
    ],
    'Results': [
      'AITA under-14 rank',
      'State champion',
      'National sub-junior',
    ],
  },

  // ── 23. Swimming Coach ─────────────────────────────
  'swimming-coach': {
    'Safety & Basics': [
      'Removes water fear fast',
      'Proper breathing technique',
      'Learn in 10 classes',
      'Certified lifeguard',
      'Separate kids pool',
    ],
    'Competitive': [
      'Freestyle specialist',
      'Backstroke',
      'Breaststroke',
      'Butterfly',
      'State swimmer maker',
    ],
    'Pool Quality': [
      '50m Olympic pool',
      'Heated pool',
      'Clean & chlorinated',
      'Girls-only batch',
    ],
    'Parent Trust': [
      'Female coach available',
      'Changing room safe',
      'No mixed advanced batch',
    ],
  },

  // ── 24. Football / Soccer Coach ────────────────────
  'football-coach': {
    'Coach Level': [
      'AIFF D-license',
      'Played I-League',
      'Ex-Santosh Trophy',
    ],
    'Training': [
      'Proper turf',
      'Goalkeeping coach',
      'Tactical sessions',
      'Matches every weekend',
    ],
    'Age Groups': [
      'Under-6 fun',
      'Under-10 competitive',
      'Girls team',
    ],
  },

  // ── 25. Basketball Coach ───────────────────────────
  'basketball-coach': {
    'Focus': [
      'Dribbling & shooting',
      'Zone defense',
      'Man-to-man',
      'Rebounding',
      'Fast break',
    ],
    'Results': [
      'District champions',
      'CBSE nationals',
      'SGFI selections',
    ],
  },

  // ── 26. Roller Skating Coach ───────────────────────
  'skating-coach': {
    'Level': [
      'Speed skating',
      'Artistic skating',
      'Beginner to pro',
      'Rink hockey',
    ],
    'Safety': [
      'Full gear mandatory',
      'Smooth floor',
      'Teaches braking first',
    ],
    'Results': [
      'State medalist maker',
      'National participants',
    ],
  },

  // ── 27. Chess Coach ────────────────────────────────
  'chess-coach': {
    'Rating & Title': [
      'FIDE rated 1800+',
      'IM/WGM coach',
      'State champion',
      'Many 1000–1500 kids',
    ],
    'Training Style': [
      'Online + offline',
      'Daily puzzles',
      'Tournament prep',
      'Opening repertoire',
      'Endgame specialist',
    ],
    'Results': [
      'National under-9',
      'State rank 1',
      'Commonwealth medal',
    ],
  },

  // ── 28. Table Tennis Coach ─────────────────────────
  'table-tennis-coach': {
    'Coach Level': [
      'State player',
      'National rank holder',
      'Played for PSPB',
    ],
    'Training': [
      'Multi-ball training',
      'Robot practice',
      'Footwork drills',
      'Rubber & blade advice',
    ],
    'Setup': [
      'Stag/Donic tables',
      'Proper hall',
      '4+ tables',
    ],
  },

  // ── 29. Karate / Martial Arts ──────────────────────
  'karate-coach': {
    'Style & Affiliation': [
      'Shotokan',
      'Goju-Ryu',
      'WKF rules',
      'Black belt instructor',
      'Affiliated dojo',
    ],
    'Focus': [
      'Self-defense',
      'Kata specialist',
      'Kumite (fighting)',
      'Discipline & respect',
      'Grading exams',
    ],
    'Kid Experience': [
      'No bullying',
      'Builds confidence',
      'Good for hyperactive kids',
      'Medal winners',
    ],
  },

  // ── 30. Gymnastics Coach ───────────────────────────
  'gymnastics-coach': {
    'Safety First': [
      'Proper matting',
      'Spotting belts',
      'Certified coach',
      'Gradual progression',
    ],
    'Discipline': [
      'Artistic gymnastics',
      'Rhythmic',
      'Tumbling',
      'Trampoline',
    ],
    'Age Groups': [
      '3–5 years',
      '6–12 competitive',
      'Girls-only',
    ],
    'Results': [
      'State gymnast',
      'National participant',
      'Flexibility + strength',
    ],
  },

  // ── 35. Dance Class (All Styles) ─────────────────────
  'dance-class': {
    'Popular Styles': [
      'Bollywood',
      'Hip-Hop',
      'Contemporary',
      'Freestyle',
      'Salsa/Bachata',
      'Zumba',
      'Garba/Dandiya',
      'Belly Dance',
    ],
    'Age & Vibe': [
      '3–6 years (tiny tots)',
      '7–12 years',
      'Teens batch',
      'Adults/Ladies only',
      'Super fun energy',
      'Performance oriented',
    ],
    'Class Experience': [
      'Amazing choreography',
      'Annual show killer',
      'Stage confidence 100%',
      'Kids beg to go',
      'No scolding, only encouragement',
      'Professional costumes',
    ],
    'Practical': [
      'AC studio',
      'Wooden floor',
      'Mirrors everywhere',
      'Flexible batches',
      'Trial class free',
    ],
    'Red Flags': [
      'Same steps every month',
      'No annual day',
      'Teacher shouts',
      'Overcrowded',
    ],
  },

  // ── 36. Bharatanatyam / Classical Dance ───────────────
  bharatanatyam: {
    'Teacher Lineage': [
      'Kalakshetra style',
      'Vazhuvoor bani',
      'Pandanaloor',
      'Direct disciple of guru',
      '30+ years teaching',
    ],
    'Training Quality': [
      'Proper adavus from day 1',
      'Strong araimandi',
      'Teaches abhinaya beautifully',
      'Corrects every detail',
      'Theory + practical',
      'Prepares for arangetram',
    ],
    'Student Achievements': [
      'Doordarshan graded artist',
      'Many arangetrams',
      'Scholarship winners',
      'Empaneled ICCR',
    ],
    'Parent Experience': [
      'Disciplined environment',
      'Respect for tradition',
      'Annual salute program',
      'Beautiful costumes & makeup',
    ],
    'Red Flags': [
      'Teaches filmy steps in classical',
      'No proper araimandi',
      'Rushes margam',
      'Money-minded arangetram',
    ],
  },

  // ── 37. Music Teacher (Vocal / Instrument) ────────────
  'music-teacher': {
    'Tradition': [
      'Carnatic vocal',
      'Hindustani classical',
      'Light music/Bhajans',
      'Semi-classical',
      'Trinity/London grades',
    ],
    'Teaching Style': [
      'Strong voice culture',
      'Perfect shruti',
      'Teaches swaras first',
      'Raga deep dive',
      'Records & sends practice tracks',
      'Prepares for exams/competitions',
    ],
    'Achievements': [
      'AIR graded artist',
      'Many prize winners',
      'Reality show participants',
      'Sur Singer level',
    ],
    'Kid Fit': [
      'Super patient with kids',
      'Starts from age 4–5',
      'Makes practice fun',
    ],
  },

  // ── 38. Guitar Teacher ───────────────────────────────
  'guitar-teacher': {
    'Curriculum': [
      'Trinity Rock & Pop',
      'Rockschool grades',
      'Bollywood + Western',
      'Fingerstyle',
      'Lead + rhythm',
      'Teaches music theory',
    ],
    'Style & Gear': [
      'Acoustic specialist',
      'Electric shredder',
      'Helps choose right guitar',
      'Teaches through songs',
      'Backing tracks provided',
    ],
    'Progress': [
      'Playing full songs in 3 months',
      'Stage performance ready',
      'Band jamming',
      'Grade 5+ cleared',
    ],
    'Kid/Teen Friendly': [
      'No boring exercises',
      'Teaches Avengers, Ed Sheeran, Arijit',
      'Super chill vibe',
    ],
  },

  // ── 39. Keyboard / Piano Teacher ─────────────────────
  'keyboard-teacher': {
    'System': [
      'Trinity Classical',
      'Trinity Rock & Pop',
      'Bollywood chords',
      'Western + Indian both',
      'Staff notation + sargam',
    ],
    'Level & Pace': [
      'Beginner to Grade 8',
      'Both hands coordination fast',
      'Teaches scales & chords properly',
      'Exam preparation',
      'Accompaniment specialist',
    ],
    'Instrument': [
      'Has Yamaha/Casio/Roland',
      'Teaches on weighted keys',
      'Helps buy right keyboard',
    ],
    'Kid Experience': [
      'Starts at age 5',
      'Disney & Harry Potter songs',
      'No scolding, only praise',
    ],
  },

  // ── 40. Drawing / Painting Teacher ───────────────────
  'drawing-teacher': {
    'Age & Level': [
      '4–7 years (tiny tots)',
      '8–12 years',
      'Elementary/Intermediate exam',
      'Teen portfolio building',
    ],
    'Mediums Taught': [
      'Pencil shading',
      'Water colours',
      'Acrylic',
      'Oil painting',
      'Poster colours',
      'Sketching portraits',
      'Mandala & doodle art',
    ],
    'Outcomes': [
      'Elementary A grade',
      'Intermediate cleared',
      'Won national competitions',
      'Beautiful birthday cards',
      'Child loves art now',
    ],
    'Class Vibe': [
      'Super encouraging',
      'Individual attention',
      'Displays every drawing',
      'Annual exhibition',
      'No copying from book',
    ],
    'Red Flags': [
      'All kids draw same thing',
      'Teacher draws, child traces',
      'No creativity allowed',
    ],
  },

  // ── 50. Civil Contractor / Builder ─────────────────────
  'civil-contractor': {
    'Trust & Peace of Mind': [
      'Never abandoned a project',
      'Finishes on time',
      'No surprise extra bills',
      'Friends have built with them',
      'Gives proper receipts',
    ],
    'Money & Contract': [
      'Fixed price – no games',
      'Honest material rates',
      'Stage-wise payment only',
      'Bank loan friendly',
    ],
    'Build Quality': [
      'Strong like a bunker',
      'No cracks or leaks',
      'Uses branded cement & steel',
      '10-year guarantee on structure',
    ],
    'Daily Experience': [
      'Sends site photos every day',
      'One person to talk to',
      'Clean & safe site',
    ],
  },

  // ── 51. Architect ─────────────────────────────────────
  architect: {
    'Design Talent': [
      'Makes small plots feel big',
      'Lots of natural light & air',
      'Beautiful modern look',
      'Perfect Vastu/Feng-Shui',
      'Smart storage ideas',
    ],
    'Practical Side': [
      'Designs within my budget',
      'Gets plan approved fast',
      'Visits site regularly',
      'Gives 3D so I can “walk” my house',
    ],
    'Trust': [
      'Licensed architect',
      'Signs every drawing',
      'Happy past clients',
    ],
  },

  // ── 52. Structural Engineer ───────────────────────────
  'structural-engineer': {
    'Safety First': [
      'Over-designs columns & beams',
      'Earthquake-safe',
      'Checks soil before design',
      'Gives safety certificate',
    ],
    'Trust': [
      'Proper degree + license',
      'Designed 50+ houses',
      'Comes to site multiple times',
    ],
  },

  // ── 53–54. Full Home / Villa Construction ─────────────
  'home-contractor': {
    'How They Work': [
      'Turnkey – I just pay & relax',
      'Finishes in 12–18 months',
      'No daily headaches',
      'Includes everything',
    ],
    'Finish Level': [
      'Basic grey structure',
      'Ready to move in',
      'Fully furnished',
      'Luxury villa finish',
    ],
  },
  'villa-contractor': {
    'Wow Factor': [
      'Swimming pool + garden',
      'Home theatre',
      'Smart home (lights, AC, curtains)',
      'Lift ready',
    ],
    'Budget': [
      '₹3–8 crore range',
      '₹8–20 crore range',
      '₹20 crore+ dream homes',
    ],
  },

  // ── 55. Turnkey Interior Contractor ───────────────────
  'interior-contractor': {
    'One-Stop Magic': [
      '45–90 day handover',
      'Fixed price, no surprises',
      'I just choose colours',
      'Includes furniture & curtains',
    ],
    'Quality You Feel': [
      'Soft-close everywhere',
      'No cheap plywood smell',
      'Branded fittings (Blum/Hafele)',
      '5–10 year warranty',
    ],
    'Trust': [
      'Big showroom you can visit',
      'Many completed projects to see',
    ],
  },

  // ── 56. Modular Kitchen Specialist ───────────────────
  'modular-kitchen': {
    'Daily Use': [
      'Pull-out magic',
      'Corner units actually work',
      'Soft-close drawers',
      'Tall unit for appliances',
    ],
    'Looks & Durability': [
      'High-gloss / matte / wood',
      'Quartz countertop (no stains)',
      'Waterproof boards',
      '10-year warranty',
    ],
  },

  // ── 57–58. Wardrobes & Custom Furniture ───────────────
'wardrobe-maker': {
  'Space Saving': [
    'Sliding doors',
    'L-shaped corner',
    'Floor-to-ceiling',
    'Loft easy to open',
    'Bed + wardrobe combo',
  ],
  'Daily Joy': [
    'Motion-sensor LEDs',
    'Soft-close drawers',
    'Hydraulic loft',
    'Saree trays',
    'Jewellery drawer + lock',
    'Shoe rack inside',
    'Pull-down rod',
  ],
  'Premium Look': [
    'High-gloss finish',
    'Matte PU',
    'Blum/Hettich fittings',
    'Profile shutters',
    'Mirror shutter',
  ],
  'Zero Tension': [
    'Marine plywood',
    '10-yr warranty',
    '1-yr free service',
    'No peeling ever',
  ],
  'Fast & Clean': [
    '15–20 days delivery',
    'Exact colour match',
    '3D design shown',
    'Daily updates',
  ],
},

'furniture-carpenter': {
  'Real Wood': [
    'Solid teak',
    'Sheesham',
    'Live-edge slab',
    'Reclaimed teak',
    'No MDF/veneer',
  ],
  'Forever Pieces': [
    'Heirloom dining',
    'Carved bed',
    'Jhoola/swing',
    'Brass inlay',
    'Temple mandir',
  ],
  'Perfect Fit': [
    'Exact custom size',
    'Matches my photo',
    'Secret drawer',
    'Hidden fridge space',
  ],
  'Better Than Branded': [
    'Half branded price',
    'Rock-solid joints',
    'Mirror polish',
    'Guests think imported',
  ],
  'Lifetime Service': [
    'Polish at home',
    'Free repairs forever',
    'Free refinish later',
    'Delivered assembled',
  ],
},

  // ── 59. False Ceiling ───────────────────────────────
  'false-ceiling': {
    'Look & Feel': [
      'Clean modern lines',
      'Cove lighting glow',
      'Hides all wires & AC ducts',
      'Makes room feel taller',
    ],
    'Practical': [
      'No cracks after years',
      'Soundproof between floors',
    ],
  },

  // ── 60. Tile / Marble / Stone Work ───────────────────
  'tile-mason': {
    'Perfectionist': [
      'Perfectly level floor',
      'No height difference',
      '45-degree edges',
      'Spacers used properly',
    ],
    'Material': [
      'Italian marble',
      'Large-format porcelain',
      'Anti-skid bathroom tiles',
    ],
  },

  // ── 61. Waterproofing ───────────────────────────────
  waterproofing: {
    'Real Guarantee': [
      '10-year no-leak promise',
      'Company-backed warranty',
      'Fixed my neighbour’s terrace',
    ],
    'Method': [
      'Injection filling',
      'Membrane + chemical',
      'Bathroom & terrace both',
    ],
  },

  // ── 62–63. Windows ───────────────────────────────────
  'aluminium-fabricator': {
    'Daily Comfort': [
      'Zero noise from outside',
      'No rain water coming in',
      'Smooth sliding',
      'Mosquito mesh included',
    ],
  },
  'upvc-windows': {
    'Premium Feel': [
      'Soundproof (airport nearby OK)',
      'Keeps house cool',
      'Double/triple glass',
      'German brand',
    ],
  },

  // ── 64. Grill / Railing ─────────────────────────────
  'grill-work': {
    'Safety + Beauty': [
      'Kid-safe spacing',
      'Glass + steel modern look',
      'Rust-proof forever',
      'LED lights on staircase',
    ],
  },

  // ── 70. Maid / Domestic Help ─────────────────────
  maid: {
    'Trust & Loyalty': [
      'Part of the family',
      '10+ years with someone we know',
      'Never takes leave without notice',
      'Trustworthy with keys & valuables',
      'Police verified + references',
    ],
    'Work Quality': [
      'Spotless cleaning',
      'Deep cleaning queen',
      'Everything organised',
      'Washes & irons perfectly',
      'Dishes sparkling',
    ],
    'Personality': [
      'Soft-spoken & respectful',
      'Loves kids & pets',
      'Hardworking & fast',
      'No phone while working',
      'Smiles always',
    ],
    'Flexibility': [
      'Live-in',
      'Full-time',
      'Morning/evening',
      'Can stay late if needed',
      'Weekend OK',
    ],
  },

  // ── 71. Home Cook ─────────────────────────────────
  cook: {
    'Taste Like Home': [
      'North Indian comfort food',
      'South Indian soul food',
      'Jain / no onion-garlic',
      'Restaurant-style',
      'Healthy & low oil',
      'Kids love everything',
    ],
    'Specialities': [
      'Perfect rotis',
      'Paneer that melts',
      'Crispy dosas',
      'Biryani on weekends',
      'Bakes cakes too',
    ],
    'Hygiene & Trust': [
      'Super clean in kitchen',
      'Wears apron & cap',
      'Brings own dabba',
      'Never tastes with hand',
    ],
    'Reliability': [
      'Comes rain or shine',
      'Same taste every day',
      'Can cook for guests',
    ],
  },

  // ── 72. Driver ───────────────────────────────────
  driver: {
    'Safety First': [
      'Drives slow & safe',
      'Never uses phone',
      'Knows all shortcuts',
      'Seatbelt for kids',
      'Clean driving record',
    ],
    'Trust & Behaviour': [
      'Well-mannered',
      'Opens door for madam/sir',
      'Never argues',
      'Helps with groceries',
      'Waits patiently',
    ],
    'Availability': [
      'Full-time with family',
      'Morning school + office',
      'Only evenings/weekends',
      'Outstation trips OK',
      'Night shifts OK',
    ],
    'Car Care': [
      'Keeps car sparkling',
      'Checks tyre pressure',
      'Reminds for service',
    ],
  },

  // ── 73. Elder Care / Patient Care ─────────────────
  'elder-care': {
    'Compassion': [
      'Treats like own parent',
      'Super patient',
      'Sits & talks with them',
      'Knows old songs',
      'Gentle with dementia',
    ],
    'Medical Skills': [
      'Trained nurse',
      'Gives medicines on time',
      'BP/sugar check',
      'Physio exercises',
      'Bedbath & feeding',
    ],
    'Trust': [
      'Female carer',
      '24-hour care',
      'Night duty OK',
      'Family knows them for years',
    ],
  },

  // ── 74. Plumber ──────────────────────────────────
  plumber: {
    'Speed & Availability': [
      'Comes same day',
      'Emergency 24×7',
      'Fixes in one visit',
      'WhatsApp one call away',
    ],
    'Honesty & Skill': [
      'Doesn’t create new problems',
      'Uses genuine spares',
      'Tells if part not needed',
      'Leak-proof guarantee',
      'Pressure pump expert',
    ],
  },

  // ── 75. Electrician ──────────────────────────────
  electrician: {
    'Safety': [
      'Proper earthing',
      'MCB/RCB expert',
      'Inverter wiring pro',
      'No loose connections',
      'Finds hidden faults',
    ],
    'Trust': [
      'Doesn’t overcharge',
      'Neat & clean work',
      '1-year guarantee',
      'Comes at night if needed',
    ],
  },

  // ── 76. House Painter ────────────────────────────
  painter: {
    'Finish Quality': [
      'No brush marks',
      'Perfect straight lines',
      'No paint smell after 2 days',
      'Walls look brand new',
      'Asian Paints/Royal only',
    ],
    'Behaviour': [
      'Covers all furniture',
      'Daily cleanup',
      'Finishes on promised date',
      'No music blasting',
    ],
  },

  // ── 77. Repair Carpenter ─────────────────────────
  carpenter: {
    'Fix-It Magic': [
      'Fixes creaking doors',
      'Polish touch-up',
      'Drawer runs smooth again',
      'Broken chair like new',
      'Same day repair',
    ],
    'Trust': [
      'Known for 15+ years',
      'Doesn’t damage other things',
      'Reasonable charges',
    ],
  },

  // ── 201. Packers & Movers ────────────────────────
  'packers-movers': {
    'Care & Trust': [
      'Nothing broken ever',
      'Labels every box',
      'TV/LED packed perfectly',
      'Plants survived',
      'Insurance covered',
    ],
    'Service': [
      'Dismantles & reassembles',
      'Same team both ends',
      'On-time delivery',
      'No hidden charges',
    ],
  },

  // ── 203. Tiffin Service ──────────────────────────
  'tiffin-service': {
    'Taste & Variety': [
      'Ghar ka khana feel',
      'Jain available',
      'Different menu daily',
      'Generous portions',
      'Less oily & spicy option',
    ],
    'Reliability': [
      'Never missed a day',
      'Hot & on time',
      'Clean steel dabbas',
      'Weekend special',
      'Trial meal available',
    ],
  },

  // ── 90. General Physician ─────────────────────
  'general-physician': {
    'Bedside Manner': [
      'Listens properly',
      'Explains clearly',
      'Doesn’t rush',
      'Good with elderly',
      'Speaks my language',
    ],
    'Treatment Style': [
      'Minimal medicines',
      'No unnecessary tests',
      'Follow-up calls',
      'Home visits possible',
      'Available after hours',
    ],
    'Practical': [
      'Short waiting time',
      'Reasonable fees',
      'Accurate diagnosis',
    ],
  },

  // ── 91. Pediatrician ─────────────────────────
  pediatrician: {
    'Child Comfort': [
      'Kids don’t cry',
      'Gentle with injections',
      'Play area in clinic',
      'Explains to child first',
    ],
    'Parent Trust': [
      'No over-prescription',
      'Honest about tests',
      'Phone advice anytime',
      'Growth & vaccine expert',
    ],
  },

  // ── 92–93. Gynecologist & Obstetrician ───────
  gynecologist: {
    'Women’s Comfort': [
      'Female doctor',
      'No judgement',
      'Privacy respected',
      'Explains everything',
      'Good with PCOS / periods',
    ],
  },
  obstetrician: {
    'Pregnancy Care': [
      'Normal delivery focus',
      'Supports VBAC',
      'Calm during labour',
      'Good with high-risk',
      'Post-delivery care',
    ],
  },

  // ── 94. Fertility / IVF Specialist ───────────
  'fertility-specialist': {
    'Success & Care': [
      'High success rate',
      'Explains every step',
      'Emotional support',
      'Transparent costs',
      'Own lab / trusted lab',
    ],
  },

  // ── 95–96. Dermatologist & Trichologist ──────
  dermatologist: {
    'Results': [
      'Acne actually cleared',
      'Pigmentation gone',
      'Realistic expectations',
      'No hard-selling',
    ],
  },
  trichologist: {
    'Hair Focus': [
      'Stopped my hair fall',
      'PRP / growth treatments',
      'Honest about transplants',
    ],
  },

  // ── 97–99. Orthopedic, Spine, Knee ───────────
  orthopedic: {
    'Approach': [
      'Tries physio first',
      'Only operates when needed',
      'Good with fractures',
      'Sports injuries',
    ],
  },
  'spine-specialist': {
    'Speciality': [
      'Minimally invasive',
      'Slip disc expert',
      'Avoids fusion if possible',
    ],
  },
  'knee-replacement': {
    'Surgery Quality': [
      'Robotic / golden knee',
      'Fast recovery',
      'Imported implant',
      'Physio package included',
    ],
  },

  // ── 100–103. Neuro & Cardiac ─────────────────
  neurologist: {
    'Common Issues': [
      'Migraine expert',
      'Stroke care',
      'Epilepsy management',
    ],
  },
  cardiologist: {
    'Prevention': [
      'Good with BP / cholesterol',
      'TMT & echo in-house',
      'Lifestyle advice',
    ],
  },

  // ── 104–106. ENT & Eye ───────────────────────
  ent: {
    'Common': [
      'Sinus / allergy expert',
      'Kids tonsils',
      'Hearing tests',
    ],
  },
  ophthalmologist: {
    'Care': [
      'Thorough eye check',
      'Good with glasses prescription',
      'Diabetic retina check',
    ],
  },
  'cataract-surgeon': {
    'Surgery': [
      'Blade-less / phaco',
      'Premium lens options',
      'Quick recovery',
    ],
  },

  // ── 107–108. Dentist & Orthodontist ──────────
  dentist: {
    'Comfort': [
      'Painless treatment',
      'Clean clinic',
      'Root canal expert',
      'Cosmetic smile makeover',
    ],
  },
  orthodontist: {
    'Braces': [
      'Invisalign certified',
      'Metal / ceramic',
      'Teen & adult both',
      'Clear treatment plan',
    ],
  },

  // ── 109–113. Gastro, Urology, Kidney, Diabetes ─
  gastroenterologist: {
    'Common': [
      'Acidity / IBS',
      'Colonoscopy expert',
      'Liver issues',
    ],
  },
  urologist: {
    'Common': [
      'Kidney stones',
      'Prostate',
      'Male infertility',
    ],
  },
  diabetologist: {
    'Management': [
      'Insulin titration',
      'CGM / pump experience',
      'Diet + lifestyle focus',
    ],
  },

  // ── 114–116. Mental Health ───────────────────
  psychiatrist: {
    'Approach': [
      'Minimal medicines',
      'Adjusts dosage carefully',
      'Long-term support',
    ],
  },
  psychologist: {
    'Therapy': [
      'CBT trained',
      'Couples counselling',
      'Anxiety & depression',
      'Child-friendly',
    ],
  },

  // ── 117–119. Cancer, Lungs, Arthritis ───────
  oncologist: {
    'Care': [
      'Explains stage clearly',
      'Coordinates chemo/radiation',
      'Supportive during treatment',
    ],
  },
  pulmonologist: {
    'Common': [
      'Asthma specialist',
      'Sleep apnea',
      'Post-COVID lung care',
    ],
  },
  rheumatologist: {
    'Management': [
      'RA biologics',
      'Pain control',
      'Joint preservation',
    ],
  },

  // ── 120–123. Therapy & Nursing ───────────────
  physiotherapist: {
    'Style': [
      'Home visits',
      'Post-surgery rehab',
      'Back/neck pain',
      'Dry needling',
    ],
  },
  'speech-therapist': {
    'Focus': [
      'Child speech delay',
      'Stammering',
      'Post-stroke recovery',
    ],
  },
  'home-nurse': {
    'Skills': [
      'Injections / dressings',
      'Catheter care',
      '24-hour duty',
      'Trained & verified',
    ],
  },

  // ── 124–126. Hospitals & Labs ────────────────
  'maternity-hospital': {
    'Delivery': [
      'High normal delivery rate',
      'Painless labour options',
      'NICU Level 3',
      'Private labour room',
    ],
  },
  'multispeciality-hospital': {
    'Trust': [
      '24×7 emergency',
      'Cashless insurance',
      'Clean & modern',
    ],
  },
  'diagnostic-lab': {
    'Reliability': [
      'Accurate reports',
      'Home collection',
      'Fast turnaround',
      'NABL accredited',
    ],
  },

  // ── 127–128. Ayurvedic & Homeopathic ─────────
  'ayurvedic-doctor': {
    'Approach': [
      'Panchakarma expert',
      'No allopathy mix',
      'Diet + lifestyle advice',
    ],
  },
  'homeopathic-doctor': {
    'Style': [
      'Classical homeopathy',
      'Skin / allergy specialist',
      'Gentle on kids',
    ],
  },

  // ── 140. Wedding Photographer ─────────────────────
  'wedding-photographer': {
    'Style': [
      'Pure candid',
      'Traditional + candid mix',
      'Cinematic',
      'Fine-art / light & airy',
      'Moody & dramatic',
      'Drone shots included',
    ],
    'Delivery & Album': [
      'All raw files given',
      'Fast delivery (30–60 days)',
      'Gorgeous premium album',
      'Same-day edit / highlight',
      'Pre-wedding shoot included',
    ],
    'Experience': [
      'Captures emotions perfectly',
      'Never misses key moments',
      'Super calm on chaotic days',
      'Family formals done fast',
      'Great with shy couples',
    ],
  },

  // ── 141. Wedding Videographer ───────────────────
  'wedding-videographer': {
    'Film Style': [
      'Cinematic highlight (3–5 min)',
      'Long documentary edit',
      'Same-day edit',
      'Drone footage',
      'Super 8 / film look',
    ],
    'Output': [
      '4K delivery',
      'Full ceremony + reception film',
      'Emotional — parents cried',
      'Great music selection',
    ],
    'On-the-day': [
      'Multiple cameras',
      'Unobtrusive team',
      'Good sound (wireless mics)',
    ],
  },

  // ── 142. Wedding Planner ────────────────────────
  'wedding-planner': {
    'Scope': [
      'Full planning (A–Z)',
      'Partial planning',
      'Month-of coordination only',
      'Destination wedding expert',
    ],
    'Strength': [
      'Saves money in the end',
      'Handles family drama',
      'Timeline runs like clockwork',
      'Creative décor ideas',
      'Best vendor connections',
    ],
    'Vibe': [
      'Calm under pressure',
      'Always reachable',
      'Understands our budget',
      'Speaks our language',
    ],
  },

  // ── 143. Wedding Caterer ────────────────────────
  caterer: {
    'Food Quality': [
      'Food tasted exactly like tasting',
      'Live counters were hit',
      'Perfect Jain / no onion-garlic',
      'North & South both great',
      'Desserts to die for',
    ],
    'Service': [
      'Staff polite & well-dressed',
      'Plates never empty',
      'Handled last-minute guest increase',
      'Clean setup & hygiene',
    ],
    'Practical': [
      'No shortage ever',
      'Good portion sizes',
      'Reasonable per-plate',
    ],
  },

  // ── 144. Bridal Makeup Artist ───────────────────
  'bridal-makeup': {
    'Look & Finish': [
      'Airbrush (lasts 15+ hrs)',
      'HD makeup',
      'Natural glow',
      'Heavy traditional',
      'Waterproof & sweat-proof',
    ],
    'Skin & Comfort': [
      'No breakouts after',
      'Uses MAC / Huda / Charlotte',
      'Sanitizes everything',
      'Touch-ups till bidai',
      'Good with oily skin',
    ],
    'Experience': [
      'Makes you feel like a queen',
      'Trial included',
      'Family makeup also great',
      'On-time & calm',
    ],
  },

  // ── 145. Mehendi Artist ─────────────────────────
  mehendi: {
    'Design & Colour': [
      'Arabic',
      'Bridal full-hand',
      'Intricate Rajasthani',
      'Dark stain in 12 hrs',
      'Modern geometric',
      'Personalised motifs',
    ],
    'Service': [
      'Finishes on time',
      'Team for guests',
      'Lemon-sugar done properly',
      'No allergic reaction',
      'Sits for photos',
    ],
  },

  // ── 160. Car Mechanic ─────────────────────────────
  'car-mechanic': {
    'Honesty & Fairness': [
      'Never suggests unnecessary work',
      'Shows old parts',
      'Genuine spares only',
      'Saves money wherever possible',
      'Fixed-price quote upfront',
    ],
    'Skill & Speciality': [
      'German car expert (BMW/Merc)',
      'Japanese/Korean specialist',
      'Diesel engine pro',
      'AC repair master',
      'Denting-painting flawless',
      'Electrical & ECU issues',
    ],
    'Service Experience': [
      'Same-day delivery',
      'Pickup & drop',
      'Clean waiting area',
      '1-year warranty on work',
      'Explains everything clearly',
    ],
  },

  // ── 161. Bike Mechanic ───────────────────────────
  'bike-mechanic': {
    'Trust': [
      'Doesn’t swap parts',
      'Uses only genuine/OEM',
      'Tells exact problem',
    ],
    'Skill': [
      'Bullet / Royal Enfield guru',
      'KTM / Ducati service',
      'Scooter expert (Activa etc.)',
      'Clutch & chain specialist',
    ],
    'Convenience': [
      'Doorstep service',
      'Open Sunday',
      'Quick service (1–2 hrs)',
    ],
  },

  // ── 180. Chartered Accountant ─────────────────────
  ca: {
    'Reliability': [
      'Never misses filing deadline',
      'Saves tax legally',
      'Handles IT notices smoothly',
      'Replies same day',
    ],
    'Expertise': [
      'GST returns & compliance',
      'Company registration',
      'Audit & ROC filings',
      'NRI taxation',
      'Startup & funding advice',
    ],
    'Fees & Transparency': [
      'Fixed annual fee',
      'No hidden charges',
      'Explains everything simply',
    ],
  },

  // ── 181. Lawyer ───────────────────────────────────
  lawyer: {
    'Specialisation': [
      'Property title & sale deed',
      'Family/divorce settlement',
      'Criminal cases',
      'Cheque bounce/498A',
      'Will & succession',
      'Builder disputes',
    ],
    'Style': [
      'Fights hard when needed',
      'Prefers out-of-court settlement',
      'Gives realistic picture',
      'Always available on phone',
    ],
  },

  // ── 182. Real-Estate Agent / Property Broker ───────
  'real-estate-agent': {
    'Trust & Ethics': [
      'Shows only genuine properties',
      'No broker pressure tactics',
      'Transparent commission',
      'Does full paperwork',
    ],
    'Strength': [
      'Knows ready-to-move flats',
      'Under-construction deals',
      'Resale specialist',
      'Builder direct rates',
      'RERA registered projects',
    ],
    'Service': [
      'Site visits arranged',
      'Loan & legal help',
      'Negotiates best price',
    ],
  },

  // ── 200. Veterinarian ─────────────────────────────
  vet: {
    'Pet Comfort': [
      'Super gentle with scared pets',
      'Explains everything to owner',
      'No unnecessary tests',
      'Vaccination schedule perfect',
    ],
    'Skill & Availability': [
      '24×7 emergency',
      'Surgery expert',
      'Indie dog specialist',
      'Good with exotic pets',
      'Home visits',
    ],
    'Clinic': [
      'Clean & hygienic',
      'In-house pharmacy & lab',
      'Reasonable charges',
    ],
  },

  // ── 202. Pandit / Priest ──────────────────────────
  pandit: {
    'Knowledge & Style': [
      'Proper Sanskrit shlokas',
      'Explains meaning',
      'Short & sweet (1–1.5 hr)',
      'No rush for dakshina',
      'North/South Indian both',
    ],
    'Popular For': [
      'Griha pravesh',
      'Satyanarayan puja',
      'Wedding rituals',
      'Shraddh & last rites',
      'Baby naming',
    ],
    'Behaviour': [
      'Punctual',
      'Brings all samagri',
      'Calm & respectful',
      'Flexible dates',
    ],
  },

  // ── FAMILY OFFICE & WEALTH ─────────────────────
  'family-office': {
    'Scope': ['Single Family Office', 'Multi-Family Office', 'Full Balance Sheet', 'Global Custody', 'Direct Deals Only'],
    'Reputation': ['3-generation old', 'London/Singapore aligned', 'Zero scandals', 'Runs $500M+ AUM quietly'],
    'Services': ['Succession Planning', 'Philanthropy Structuring', 'Art & Wine Portfolio', 'Citizenship Planning', 'Family Constitution'],
    'Discretion': ['Fort Knox level NDA', 'No name on website', 'References only via intro'],
  },
  'private-banker': {
    'Bank': ['Coutts', 'Julius Baer', 'UBS PC', 'J.P. Morgan Private', 'HSBC Jade/Premier Elite', 'Kotak Privée', 'ICICI Wealth Black'],
    'Relationship': ['10+ year RM', 'Family knows since grandfather', 'Gets allocation in closed funds', 'Never pushes product'],
    'Perks': ['Centurion Black invite', 'Airport lounge for entire family', 'Guaranteed villa upgrades'],
  },
  'portfolio-manager': {
    'Style': ['Category III AIF', 'PMS only', 'Long-only equity', 'Long-short', 'Pre-IPO specialist'],
    'Track Record': ['Beaten Nifty 5 yrs+', 'Zero down years', 'Many 3x–5x returns', 'Quiet 25%+ CAGR'],
    'Access': ['Minimum 10cr', 'Invite only', 'Family office circle'],
  },
  'alternative-investments': {
    'Focus': ['Pre-IPO', 'Venture Debt', 'Distressed Real Estate', 'Vintage Wine Funds', 'Fractional Private Jet'],
    'Deal Flow': ['Unicorn at 20% of last round', 'Gets first call from top VCs', 'Co-invest with marquee names'],
  },

  // ── ART & COLLECTIBLES ───────────────────────
  'art-advisor': {
    'Level': ['Sotheby’s/Christie’s ex', 'Advises $100M+ collections', 'Gets Basel VIP', 'Knows every Indian master'],
    'Specialty': ['Modi, Raza, Souza', 'Contemporary Indian', 'Antiquities (careful)', 'Blue-chip international'],
    'Trust': ['Never flips client’s art', 'Discreet storage in Geneva', 'Insurance valuation expert'],
  },
  'wine-cellar-advisor': {
    'Cred': ['Bordeaux First Growth direct', 'DRC allocation', 'Screagle, Harlan, Petrus', 'Owns temperature-controlled warehouse'],
    'Services': ['Cellar build in Delhi heat', 'Fake detection', 'Auction representation'],
  },
  'watch-concierge': {
    'Access': ['Patek 5711/1A at retail', 'Rolex Daytona waitlist bypass', 'FP Journe, Richard Mille allocation'],
    'Grey Market': ['Buys & sells discreetly', 'Never burns client', '100% authentic guarantee'],
  },
  'jewellery-concierge': {
    'Level': ['Golconda diamonds', 'Burmese ruby no-heat', 'Kashmir sapphire', 'Harry Winston/Buccellati direct'],
    'Services': ['Red carpet borrowing', 'Custom high jewellery', 'Discreet resale at profit'],
  },

  // ── LUXURY LIFESTYLE ─────────────────────────
  'luxury-real-estate': {
    'Pocket': ['Juhu beachfront', 'Malabar Hill duplex', 'Lutyens Delhi 3-acre', 'Palm Jumeirah signature villa'],
    'Style': ['Off-market only', 'Never on 99acres', 'Gets distress sales before bank'],
  },
  'bespoke-tailor': {
    'House': ['Savile Row (Gieves, Huntsman)', 'Napoli (Rubinacci, Kiton)', 'Hong Kong (WW Chan)'],
    'Cred': ['Measures in your home', '20+ fittings', 'Cloth from Scabal/Dormeuil'],
  },
  'private-chef': {
    'Background': ['Michelin 2–3 star', 'Worked for royal family', 'Ex-Taj/Oberoi palace head chef'],
    'Cuisine': ['Molecular Indian', 'Japanese Omakase', 'French degustation', '100% Jain'],
  },
  'butler': {
    'Training': ['Guild of Professional English Butlers', 'Norland nanny + butler', 'Ex-Royal household'],
    'Scope': ['Runs 5 homes seamlessly', 'Manages 40 staff', 'Speaks Hindi + English + French'],
  },
  'governess': {
    'Background': ['Oxford/Cambridge graduate', 'Norland College', 'Fluent Mandarin/French + English'],
    'Scope': ['IB/A-levels tutor', 'Etiquette & languages', 'Travel with child'],
  },

  // ── EDUCATION & ADMISSIONS ───────────────────
  'international-school-advisor': {
    'Schools': ['Dhirubhai Ambani ISCE', 'Singapore (UWC, Tanglin)', 'UK boarding (Eton, Harrow, Wycombe)'],
    'Success': ['100% placement', 'Gets waitlisted kids in', 'Knows principals personally'],
  },
  'ivy-league-consultant': {
    'Track Record': ['10+ Harvard/Yale/Stanford admits', 'Full-ride scholarships', 'Knows every AO by name'],
    'Style': ['Essay coaching genius', 'Builds Olympic-level profile from Class 8'],
  },

  // ── TRAVEL & TRANSPORT ───────────────────────
  'private-jet-broker': {
    'Perks': ['Empty legs ₹1.5L/hr', 'Guaranteed Gulfstream G650', 'Pet-friendly', 'Bedrooms on board'],
    'Trust': ['Never cancels last minute', '24/7 on WhatsApp'],
  },
  'yacht-broker': {
    'Access': ['Monaco charter week', 'Maldives private island buyout', 'Amels/Feadship new build slot'],
  },
  'luxury-travel-concierge': {
    'Level': ['Virtuoso', 'Traveler Made', 'Ex-FS head concierge'],
    'Access': ['Aman junket', 'Micombero private island', 'Guaranteed Four Seasons PV suite'],
  },
  'private-island-rental': {
    'Destinations': ['Maldives full island', 'Fiji (Vatuvara)', 'Caribbean overwater buyout'],
  },

  // ── SECURITY & PROTECTION ────────────────────
  'private-security': {
    'Team': ['Ex-NSG/Black Cat', 'Mossad-trained', 'British CP certified'],
    'Scope': ['Child pickup', '24/7 shadow', 'Global coverage', 'Kidnap response plan'],
  },
  'armored-vehicle': {
    'Level': ['B6/B7', 'Run-flat tyres', 'Bomb-proof', 'Discreet look (no Fortuner vibes)'],
  },

  // ── AESTHETIC & LONGEVITY ────────────────────
  'plastic-surgeon': {
    'Reputation': ['Flown to Seoul/Dubai for surgery', 'Natural result', 'Zero botched cases in circle'],
    'Specialty': ['Rhinoplasty god', 'Facelift (deep plane)', 'Mommy makeover'],
  },
  'hair-transplant': {
    'Result': ['Celebrity density', 'FUE sapphire', 'Zero scar', 'Looks 100% natural from day 1'],
  },
  'anti-aging-clinic': {
    'Treatments': ['NAD+ IV', 'Stem cell', 'Swiss bioidentical hormones', 'Full longevity protocol'],
  },

  // ── LEGACY & PHILANTHROPY ────────────────────
  'trustee': {
    'Jurisdiction': ['Singapore trust', 'Cayman STAR', 'Jersey foundation'],
    'Cred': ['Structures $100cr+ families', 'Zero tax leakage', 'Bulletproof asset protection'],
  },
  'succession-planner': {
    'Scope': ['Family constitution done', 'Avoids 3rd-gen fights', 'Runs family council'],
  },
  'philanthropy-advisor': {
    'Impact': ['Set up ₹500cr foundation', 'Gates Foundation partner', 'GiveIndia board level'],
  },

  // ── EXCLUSIVE CLUBS & SPORT ──────────────────
  'private-members-club': {
    'Club': ['Soho House Mumbai', 'The 2520 (Delhi)', 'Capital Club Dubai', 'Core Club NY invite'],
  },
  'polo-club': {
    'Location': ['Jaipur Polo Grounds', 'Delhi Polo Club', 'Buenos Aires (full season)'],
  },
  'horse-breeder': {
    'Bloodlines': ['Derby winners', 'Australian/German thoroughbreds', 'Polo ponies'],
  },

  // ── CARS ─────────────────────────────────────
  'supercar-dealer': {
    'Brands': ['Ferrari (new 296/SF90)', 'Lamborghini (Revuelto slot)', 'Porsche GT3 RS allocation'],
    'Trust': ['Never flips client slot', 'Gives below-MSRP to old clients'],
  },
  'vintage-car-restorer': {
    'Level': ['Pebble Beach concours winner', 'Restores E-Type, 250 GTO replicas'],
  },

  // ==========================================
  // 12. HYPER-LOCAL GOVT & PAPERWORK FIXERS
  // ==========================================
  'rto-agent': {
    'Speed': [
      'Same-day RC transfer',
      'Duplicate RC in 2 days',
      'Hypothec removal fast',
      'Fancy number guaranteed',
      'Passing without vehicle',
      'Old pending cleared',
    ],
    'Trust & Safety': [
      '30+ years experience',
      'Direct RTO contact',
      'No police case later',
      'Genuine work only',
      'Shows all papers',
      'No middlemen',
    ],
    'Special Powers': [
      'Commercial registration',
      'Scrap certificate',
      'National permit',
      'International DL',
      'Learner’s in 1 hour',
    ],
    'Red Flags': [
      'Takes money & vanishes',
      'Fake NOC',
      'Blackmails later',
    ],
  },

  'property-tax-fixer': {
    'Magic Delivered': [
      'Mutation in 7 days',
      'Khata A in BBMP',
      'BDA khata transfer',
      'Gram panchayat to A-khata',
      'Old tax arrears cleared',
      'Betterment charges waived',
    ],
    'Trust': [
      'Known since 20+ years',
      'Works directly with officers',
      'No fake documents',
      'Gives original receipts',
    ],
  },

  'revenue-dept-fixer': {
    'Land Records': [
      'RTC correction',
      '11E sketch',
      'Phodi done',
      'Hissa partition',
      'Survey number split',
      'Akharbandh',
      'Muthation old records',
    ],
    'Trust': [
      'Tahsil office direct',
      'No court case later',
      'Gives certified copies',
    ],
  },

  'passport-agent': {
    'Speed & Type': [
      'Tatkal in 3–5 days',
      'Normal in 10 days',
      'Minor passport fast',
      'Renewal same week',
      'Lost passport urgent',
      'Police verification skipped',
    ],
    'Trust': [
      '100% genuine',
      'No rejection history',
      'Direct PSK contact',
      'Returns original docs',
    ],
  },

  'police-verification-fixer': {
    'Clearance Type': [
      'Passport PV cleared',
      'Job PV (Govt/Private)',
      'Rent agreement PV',
      'Negative report fixed',
      'Old case cleared',
    ],
    'Trust': [
      'Known thana level',
      'No follow-up needed',
      'Report comes clean',
    ],
  },

  'electricity-board-fixer': {
    'Powers': [
      'New connection fast',
      'Name transfer same day',
      'Load increase',
      'Meter tampering fixed',
      'Bill correction',
      'Commercial meter',
    ],
    'Trust': [
      'BESCOM direct',
      'No future notice',
      'Genuine receipt',
    ],
  },

  'liquor-permit': {
    'Permit Type': [
      'CL-9 (party permit)',
      'CL-2 retail',
      'FLR bar license',
      'Temporary party permit',
      'Wedding bulk permit',
    ],
    'Trust & Speed': [
      '100% approval',
      'Excise dept direct',
      'No raid later',
      'Old agent family',
    ],
  },

  // ==========================================
  // 13. SENSITIVE & SPECIALIZED SERVICES
  // ==========================================
  'deaddiction-centre': {
    'Approach': [
      'Very compassionate staff',
      'Family counseling included',
      '12-step program',
      'Success rate high',
      'Motivational doctors',
      'No harsh treatment',
    ],
    'Privacy & Care': [
      '100% confidential',
      'No name on records',
      'VIP private room',
      'Phone allowed',
      'Home-like food',
    ],
    'Outcome': [
      'Person came back transformed',
      'Stayed sober 2+ years',
      'Family reunited',
    ],
  },

  'divorce-lawyer': {
    'Style': [
      'Mutual consent super fast',
      'Contested fighter',
      'Woman-friendly',
      'Child custody expert',
      'Alimony minimized',
      'Settlement outside court',
      'Protects family reputation',
    ],
    'Trust': [
      'Very discreet',
      'No publicity',
      'High court level',
      'Many rich clients',
    ],
  },

  'adoption-lawyer': {
    'Type': [
      'Legal guardianship fast',
      'CARA registered',
      'In-family adoption',
      'Relative adoption',
      'Hindu/Christian/Muslim',
    ],
    'Trust': [
      '100% court approval',
      'No agency middlemen',
      'Child gets everything legally',
    ],
  },

  'surrogacy-clinic': {
    'Ethics & Care': [
      '100% ethical',
      'Surrogate well taken care of',
      'Legal contract solid',
      'Top embryologist',
      'High success rate',
      'NDA standard',
    ],
    'Privacy': [
      'Complete anonymity',
      'No one finds out',
      'VIP treatment',
    ],
  },

  'egg-donor': {
    'Donor Quality': [
      'Ivy league level',
      'Doctor/Engineer background',
      'Fair & tall',
      'Screened & healthy',
      'Proven fertility',
    ],
    'Privacy': [
      '100% anonymous',
      'Donor never contacts',
      'Legal agreement',
    ],
  },

  'private-detective': {
    'Specialization': [
      'Pre-matrimonial check',
      'Spouse loyalty check',
      'Missing person',
      'Corporate espionage',
      'Background verification',
    ],
    'Discretion': [
      'Ex-IB/CID',
      'Zero leakage',
      'Evidence court admissible',
      'NDA signed',
    ],
  },

  'discreet-abortion': {
    'Safety & Care': [
      'Top gynaecologist',
      'Painless pills/method',
      'Same-day procedure',
      'No questions asked',
      'Post-care medicines given',
    ],
    'Privacy': [
      '100% confidential',
      'No records',
      'Back entrance',
      'Female doctor',
      'Home visit possible',
    ],
  },

  'old-age-home': {
    'Quality of Life': [
      '5-star facilities',
      'Like own home',
      '24×7 doctor',
      'Jain/Sattvik food',
      'Temple inside',
      'Activities & physiotherapy',
      'Couples allowed',
    ],
    'Care': [
      'Loving staff',
      'No bed sores',
      'Family can visit anytime',
      'End-of-life care excellent',
    ],
  },

  // ==========================================
  // 14. "LIFE SAVER" — People you protect with your life
  // ==========================================

  '20-year-maid': {
    'Loyalty Level': [
      '20+ years in one family',
      '25+ years still working',
      '30+ years golden jubilee',
      'Part of the family',
      'Raised 3 generations',
      'Will never leave',
      'Kids call her “Didi”/“Ammi”',
    ],
    'Trust Depth': [
      'Has house keys since decades',
      'Knows all safe codes',
      'Handles everything when family travels abroad',
      'Never took a single leave without notice',
      'Family consults her before decisions',
    ],
    'Skills': [
      'Cooks exactly like grandmother',
      'Manages entire household',
      'Trains new staff',
      'Still climbs ladder to clean fans',
    ],
    'Legend Status': [
      'Neighbours jealous',
      'Relatives try to poach',
      'Offered double salary but refused',
    ],
  },

  'honest-gold-buyer': {
    'Fairness': [
      'Gives today’s full market rate',
      'No melting deduction tricks',
      'No “making charge” drama',
      'Pays instant NEFT — no cash nonsense',
      'Shows live rate on screen',
      'Same rate for family jewellery',
    ],
    'Trust Signals': [
      'Known since grandfather’s time',
      'Buys from doctors & CAs only',
      'Never asks “where did you get this?”',
      'Gave highest rate in entire city',
      'Will store & return if you change mind',
    ],
    'Red Flags (others do)': [
      'Deducts 5–8% randomly',
      'Says “stone weight extra”',
      'Delays payment 2–3 days',
      'Suddenly closes shop after big deal',
    ],
  },

  'genuine-parts-mechanic': {
    'Honesty': [
      '100% genuine parts only',
      'Shows old part + bill',
      'Never reuses old parts',
      'Refuses duplicate parts even if you ask',
      'Says “not required” and saves lakhs',
    ],
    'Skill + Trust': [
      'Dealership level work, half price',
      'German car specialist',
      'Engine overhaul like new',
      'Shows live camera while working',
      'Gives 1–2 year warranty',
      'Pickup & drop free',
    ],
    'Life Saver Moments': [
      'Saved ₹3.5L on fake turbo issue',
      'Refused to change entire gearbox — just one sensor',
      'Opened on Sunday for emergency',
    ],
  },

  'trustworthy-driver': {
    'Background': [
      '20+ years with one family',
      'Ex-Army / Ex-Police',
      'Police verified + Aadhaar linked',
      'Family knows his village',
      'Kids fall asleep in car — total trust',
    ],
    'Driving & Behavior': [
      'Never overspeeds',
      'Knows all shortcuts',
      'Car always clean & fuelled',
      'Drops madam first in rain',
      'Never uses phone while driving',
      'Speaks politely with cops',
    ],
    'Loyalty': [
      'Refused 50% higher offers',
      'Stayed during family’s 3-year London stay',
      'Took care of car like his own',
    ],
  },

  'honest-contractor': {
    'Delivery': [
      'Finished on exact date promised',
      'No cost escalation',
      'No “material rate increased” drama',
      'Handed over with OC',
      'Zero bank loan issues',
    ],
    'Quality & Trust': [
      'Uses branded material only',
      'No cutting corners',
      'Daily WhatsApp updates + photos',
      'Lets you buy material directly',
      'Workers well-paid & polite',
      'Vastu compliant without extra charge',
    ],
    'Legend Status': [
      'Built 10+ houses — all happy',
      'People wait 2 years for his slot',
      'Gave keys before final payment',
    ],
  },

  // ==========================================
  // 15. GLOBAL / GREY-AREA / HIGH-LEVEL LIAISON
  // ==========================================

  'citizenship-broker': {
    'Programs': [
      'Malta MEIN — fastest',
      'Caribbean (St Lucia/Dominica)',
      'Turkey $400k property',
      'Portugal Golden Visa',
      'Greece €250k',
      'Vanuatu 21 days',
    ],
    'Trust & Speed': [
      'Done 50+ families silently',
      '100% success rate',
      'Lawyer + broker in one',
      'Direct with government',
      'Full refund if rejected',
      'NDA standard',
    ],
    'Discretion': [
      'Name never appears anywhere',
      'Uses family trust structure',
      'No social media',
      'Meets only in London/Dubai',
    ],
  },

  'offshore-company': {
    'Jurisdictions': [
      'BVI — zero tax',
      'Cayman — prestige',
      'Dubai DMCC',
      'Singapore — respected',
      'Mauritius GBC',
      'Hong Kong — China play',
      'Delaware/Canada for invoices',
    ],
    'Services': [
      'Bank account in 10 days',
      'EMI / Mercury / Wise friendly',
      'Nominee director included',
      'Substance setup if needed',
      'Full anonymity possible',
    ],
    'Trust': [
      'Running since 2000s',
      'Never leaked client name',
      'Works with Big 4 CAs',
      'Will close company cleanly if needed',
    ],
  },

  'nd-therapist': {
    'Privacy Level': [
      'Strict NDA — legally enforceable',
      'No notes, no recordings',
      'Payment in cash/crypto',
      'Meets at neutral location or home',
      'Uses burner phone for contact',
      'Never confirms you’re a client',
    ],
    'Clientele': [
      'CEOs & promoters',
      'Politicians’ families',
      'Celebrities',
      'Second-generation business heirs',
    ],
    'Specialties': [
      'Family business disputes',
      'Succession anxiety',
      'Founder depression',
      'High-stakes divorce prep',
      'Addiction (silent rehab coordination)',
    ],
    'Trust': [
      'Recommended only by one existing client',
      'Waitlist 6–12 months',
      'Will never write a book',
    ],
  },
} as const;
