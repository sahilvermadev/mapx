import { createQuestionAnswerNotification } from '../db/notifications';
import pool from '../db';

// Mock the database pool
jest.mock('../db', () => ({
  query: jest.fn()
}));

const mockPool = pool as jest.Mocked<typeof pool>;

describe('Question Answer Notifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create notification when question is answered by different user', async () => {
    // Mock question query result
    mockPool.query
      .mockResolvedValueOnce({
        rows: [{
          user_id: 'question-author-id',
          text: 'What is the best restaurant in downtown?',
          display_name: 'Question Author',
          username: 'questionauthor'
        }]
      })
      // Mock answerer query result
      .mockResolvedValueOnce({
        rows: [{
          display_name: 'Answer Author',
          username: 'answerauthor'
        }]
      })
      // Mock notification insert
      .mockResolvedValueOnce({ rows: [] });

    await createQuestionAnswerNotification(123, 'answerer-id', 456);

    expect(mockPool.query).toHaveBeenCalledTimes(3);
    
    // Verify notification insert
    const insertCall = mockPool.query.mock.calls[2];
    expect(insertCall[0]).toContain('INSERT INTO notifications');
    expect(insertCall[1]).toEqual([
      'question-author-id',
      'question_answered',
      'Answer Author answered your question',
      JSON.stringify({
        question_id: 123,
        answered_by_user_id: 'answerer-id',
        recommendation_id: 456,
        question_preview: 'What is the best restaurant in downtown?'
      })
    ]);
  });

  it('should not create notification when user answers their own question', async () => {
    // Mock question query result with same user
    mockPool.query.mockResolvedValueOnce({
      rows: [{
        user_id: 'same-user-id',
        text: 'What is the best restaurant in downtown?',
        display_name: 'Same User',
        username: 'sameuser'
      }]
    });

    await createQuestionAnswerNotification(123, 'same-user-id', 456);

    // Should only call question query, not answerer query or insert
    expect(mockPool.query).toHaveBeenCalledTimes(1);
  });

  it('should handle missing question gracefully', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    await createQuestionAnswerNotification(999, 'answerer-id', 456);

    expect(mockPool.query).toHaveBeenCalledTimes(1);
  });

  it('should handle missing answerer gracefully', async () => {
    mockPool.query
      .mockResolvedValueOnce({
        rows: [{
          user_id: 'question-author-id',
          text: 'What is the best restaurant in downtown?',
          display_name: 'Question Author',
          username: 'questionauthor'
        }]
      })
      .mockResolvedValueOnce({ rows: [] });

    await createQuestionAnswerNotification(123, 'missing-answerer-id', 456);

    expect(mockPool.query).toHaveBeenCalledTimes(2);
  });
});






























