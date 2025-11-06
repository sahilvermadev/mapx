import React, { useState } from 'react';
import RecommendationComposer from '@/components/RecommendationComposer';

interface AnswerQuestionModalProps {
  open: boolean;
  questionId: number;
  questionText?: string;
  onClose: () => void;
  onSubmitted?: (id: number, recommendationId: number) => void;
  currentUserId: string;
}

export const AnswerQuestionModal: React.FC<AnswerQuestionModalProps> = ({ 
  open, 
  questionId, 
  questionText, 
  onClose, 
  onSubmitted,
  currentUserId 
}) => {
  const [showComposer, setShowComposer] = useState(false);

  const handleComposerClose = () => {
    setShowComposer(false);
    onClose();
  };

  const handleRecommendationCreated = async () => {
    // The RecommendationComposer will handle creating the answer internally
    // We need to notify the parent and close the modal
    if (onSubmitted) {
      // We don't have the recommendation ID here, but we can pass the question ID
      // The parent component should refresh the data
      onSubmitted(questionId, 0); // 0 as placeholder for recommendation ID
    }
    onClose();
  };

  if (!open) return null;

  // Show composer directly with question context
  if (showComposer) {
    return (
      <div className="fixed inset-0 z-50 bg-black/50">
        <div className="h-full flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-4xl h-[90vh] rounded-md shadow-xl overflow-hidden">
            <div className="p-4 border-b">
              <h3 className="text-lg font-semibold">Answer: {questionText}</h3>
              <p className="text-sm text-gray-600">Create a recommendation to answer this question</p>
            </div>
            <div className="h-full overflow-auto">
              <RecommendationComposer
                isOpen={true}
                onClose={handleComposerClose}
                onPostCreated={handleRecommendationCreated}
                currentUserId={currentUserId}
                questionContext={questionText}
                questionId={questionId}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Initial simple view - just a button to start the composer
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white w-full max-w-lg rounded-md p-6 shadow-xl">
        <h3 className="text-lg font-semibold mb-2">Answer this question</h3>
        <p className="text-sm text-gray-600 mb-4">{questionText}</p>
        
        <p className="text-sm text-gray-500 mb-4">
          Create a recommendation to help answer this question. We'll guide you through the process.
        </p>

        <div className="flex justify-end gap-2">
          <button className="px-4 py-2 rounded-md border" onClick={onClose}>Cancel</button>
          <button 
            className="px-4 py-2 rounded-md bg-blue-600 text-white" 
            onClick={() => setShowComposer(true)}
          >
            Create Recommendation
          </button>
        </div>
      </div>
    </div>
  );
};


