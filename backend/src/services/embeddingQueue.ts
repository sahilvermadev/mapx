import { generateAnnotationEmbedding, generateRecommendationEmbedding } from '../utils/embeddings';
import { getPlaceById, getUserById } from '../db/places';
import { getServiceById } from '../db/services';
import pool from '../db';

export interface EmbeddingTask {
  id: string;
  type: 'annotation' | 'recommendation';
  recordId: number;
  data: any;
  retryCount: number;
  maxRetries: number;
  createdAt: Date;
  priority: 'high' | 'normal' | 'low';
}

export interface EmbeddingQueueConfig {
  maxConcurrent: number;
  retryDelay: number; // milliseconds
  maxRetries: number;
  batchSize: number;
}

class EmbeddingQueue {
  private queue: EmbeddingTask[] = [];
  private processing: Set<string> = new Set();
  private config: EmbeddingQueueConfig;
  private isProcessing = false;

  constructor(config: EmbeddingQueueConfig = {
    maxConcurrent: 3,
    retryDelay: 5000,
    maxRetries: 3,
    batchSize: 5
  }) {
    this.config = config;
  }

  /**
   * Add a task to the embedding queue
   */
  async enqueue(
    type: 'annotation' | 'recommendation',
    recordId: number,
    data: any,
    priority: 'high' | 'normal' | 'low' = 'normal'
  ): Promise<string> {
    const taskId = `${type}-${recordId}-${Date.now()}`;
    
    const task: EmbeddingTask = {
      id: taskId,
      type,
      recordId,
      data,
      retryCount: 0,
      maxRetries: this.config.maxRetries,
      createdAt: new Date(),
      priority
    };

    // Insert task based on priority
    if (priority === 'high') {
      this.queue.unshift(task);
    } else {
      this.queue.push(task);
    }

    console.log(`Queued embedding task: ${taskId} (${type} ${recordId})`);
    
    // Start processing if not already running
    if (!this.isProcessing) {
      this.processQueue();
    }

    return taskId;
  }

  /**
   * Process the embedding queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    console.log('Starting embedding queue processing...');

    while (this.queue.length > 0 || this.processing.size > 0) {
      // Process available slots
      const availableSlots = this.config.maxConcurrent - this.processing.size;
      
      if (availableSlots > 0 && this.queue.length > 0) {
        const tasksToProcess = this.queue.splice(0, availableSlots);
        
        // Process tasks concurrently
        tasksToProcess.forEach(task => {
          this.processTask(task);
        });
      }

      // Wait a bit before checking again
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    this.isProcessing = false;
    console.log('Embedding queue processing completed');
  }

  /**
   * Process a single embedding task
   */
  private async processTask(task: EmbeddingTask): Promise<void> {
    this.processing.add(task.id);
    
    try {
      console.log(`Processing embedding task: ${task.id}`);
      
      // Get full record data if only minimal data was provided
      let recordData = task.data;
      if (!task.data.user_id || Object.keys(task.data).length <= 2) {
        recordData = await this.getFullRecordData(task.type, task.recordId);
      }
      
      // Get place, service and user information for enhanced embedding
      const [place, service, user] = await Promise.all([
        recordData.place_id ? getPlaceById(recordData.place_id) : null,
        recordData.service_id ? getServiceById(recordData.service_id) : null,
        getUserById(recordData.user_id)
      ]);

      // Create enhanced data with place and user info
      const enhancedData = {
        ...recordData,
        place_name: place?.name,
        place_address: place?.address,
        user_name: user?.display_name,
        // service enrichment
        service_name: service?.name,
        service_type: service?.service_type,
        business_name: service?.business_name,
        address: service?.address
      };

      // Generate embedding (different strategy for recommendations vs annotations)
      const embedding = task.type === 'recommendation'
        ? await generateRecommendationEmbedding({
            content_type: enhancedData.content_type,
            title: enhancedData.title,
            description: enhancedData.description,
            labels: enhancedData.labels,
            rating: enhancedData.rating,
            place_name: enhancedData.place_name,
            place_address: enhancedData.place_address,
            service_name: enhancedData.service_name,
            service_type: enhancedData.service_type,
            business_name: enhancedData.business_name,
            address: enhancedData.address,
            user_name: enhancedData.user_name,
            content_data: enhancedData.content_data,
            metadata: enhancedData.metadata,
          })
        : await generateAnnotationEmbedding(enhancedData);

      // Update the record in database
      await this.updateRecordWithEmbedding(task.type, task.recordId, embedding);
      
      console.log(`Successfully processed embedding task: ${task.id}`);
      
    } catch (error) {
      console.error(`Failed to process embedding task ${task.id}:`, error);
      
      // Retry logic
      if (task.retryCount < task.maxRetries) {
        task.retryCount++;
        console.log(`Retrying embedding task ${task.id} (attempt ${task.retryCount}/${task.maxRetries})`);
        
        // Add back to queue with delay
        setTimeout(() => {
          this.queue.unshift(task);
        }, this.config.retryDelay);
      } else {
        console.error(`Permanently failed embedding task ${task.id} after ${task.maxRetries} retries`);
        // Could implement dead letter queue here
      }
    } finally {
      this.processing.delete(task.id);
    }
  }

  /**
   * Get full record data from database
   */
  private async getFullRecordData(
    type: 'annotation' | 'recommendation',
    recordId: number
  ): Promise<any> {
    const client = await pool.connect();
    
    try {
      const table = type === 'annotation' ? 'annotations' : 'recommendations';
      const query = `SELECT * FROM ${table} WHERE id = $1`;
      
      const result = await client.query(query, [recordId]);
      
      if (result.rows.length === 0) {
        throw new Error(`${type} not found`);
      }
      
      return result.rows[0];
      
    } catch (error) {
      console.error(`Failed to get full record data for ${type} ${recordId}:`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Update record with generated embedding
   */
  private async updateRecordWithEmbedding(
    type: 'annotation' | 'recommendation',
    recordId: number,
    embedding: number[]
  ): Promise<void> {
    const client = await pool.connect();
    
    try {
      const table = type === 'annotation' ? 'annotations' : 'recommendations';
      const query = `
        UPDATE ${table} 
        SET embedding = $1, updated_at = CURRENT_TIMESTAMP 
        WHERE id = $2
      `;
      
      await client.query(query, [`[${embedding.join(',')}]`, recordId]);
      console.log(`Updated ${type} ${recordId} with embedding`);
      
    } catch (error) {
      console.error(`Failed to update ${type} ${recordId} with embedding:`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get queue status
   */
  getStatus(): {
    queueLength: number;
    processing: number;
    isProcessing: boolean;
  } {
    return {
      queueLength: this.queue.length,
      processing: this.processing.size,
      isProcessing: this.isProcessing
    };
  }

  /**
   * Clear the queue (for testing)
   */
  clear(): void {
    this.queue = [];
    this.processing.clear();
    this.isProcessing = false;
  }
}

// Export singleton instance
export const embeddingQueue = new EmbeddingQueue();

// Export the class for testing
export { EmbeddingQueue };
