/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
  // Add bio and city columns to users table
  pgm.addColumn('users', {
    bio: {
      type: 'TEXT',
      notNull: false,
    },
    city: {
      type: 'VARCHAR(255)',
      notNull: false,
    },
  });
};

exports.down = pgm => {
  // Remove bio and city columns from users table
  pgm.dropColumn('users', ['bio', 'city']);
};



