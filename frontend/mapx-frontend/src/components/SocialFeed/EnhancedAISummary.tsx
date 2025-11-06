import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, MapPin, Star, Users, Clock, Award } from 'lucide-react';

interface EnhancedAISummaryProps {
  text: string;
  totals?: { places: number; recs: number };
  rawData?: any[];
}

const EnhancedAISummary: React.FC<EnhancedAISummaryProps> = ({ text, totals, rawData = [] }) => {
  // Process data for visualizations
  const chartData = useMemo(() => {
    if (!rawData.length) return null;
    
    return {
      ratings: rawData.map((item, index) => ({
        name: item.place_name || item.service_name || `Item ${index + 1}`,
        rating: item.average_similarity * 5,
        recommendations: item.total_recommendations,
      })),
      categories: rawData.reduce((acc, item) => {
        const category = item.type === 'place' ? 'Places' : 'Services';
        acc[category] = (acc[category] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };
  }, [rawData]);

  const pieData = useMemo(() => {
    if (!chartData?.categories) return [];
    return Object.entries(chartData.categories).map(([name, value]) => ({
      name,
      value,
      color: name === 'Places' ? '#3b82f6' : '#10b981',
    }));
  }, [chartData]);

  const averageRating = useMemo(() => {
    if (!chartData?.ratings.length) return 0;
    return chartData.ratings.reduce((sum, item) => sum + item.rating, 0) / chartData.ratings.length;
  }, [chartData]);

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-blue-500 p-6 rounded-r-lg shadow-lg">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
          <span className="text-white text-sm font-bold">AI</span>
        </div>
        
        <div className="flex-1 space-y-6">
          {/* Rich Text Content */}
          <div className="prose prose-lg max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
              components={{
                h1: ({ children }) => (
                  <h1 className="text-2xl font-bold text-blue-600 mb-4 flex items-center gap-2">
                    <Award className="h-6 w-6" />
                    {children}
                  </h1>
                ),
                h2: ({ children }) => (
                  <h2 className="text-xl font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    {children}
                  </h2>
                ),
                h3: ({ children }) => (
                  <h3 className="text-lg font-medium text-gray-700 mb-2">{children}</h3>
                ),
                ul: ({ children }) => (
                  <ul className="list-disc list-inside space-y-2 text-gray-700">{children}</ul>
                ),
                li: ({ children }) => (
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500 mt-1">•</span>
                    <span>{children}</span>
                  </li>
                ),
                strong: ({ children }) => (
                  <strong className="font-semibold text-gray-900 bg-yellow-100 px-1 rounded">
                    {children}
                  </strong>
                ),
                blockquote: ({ children }) => (
                  <blockquote className="border-l-4 border-blue-500 pl-4 italic text-gray-600 bg-blue-50 py-2 rounded-r">
                    {children}
                  </blockquote>
                ),
              }}
            >
              {text}
            </ReactMarkdown>
          </div>

          {/* Statistics Cards */}
          {totals && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-lg shadow-sm border">
                <div className="flex items-center gap-2 text-blue-600">
                  <MapPin className="h-5 w-5" />
                  <span className="text-sm font-medium">Places</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{totals.places}</p>
              </div>
              
              <div className="bg-white p-4 rounded-lg shadow-sm border">
                <div className="flex items-center gap-2 text-green-600">
                  <Users className="h-5 w-5" />
                  <span className="text-sm font-medium">Reviews</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{totals.recs}</p>
              </div>
              
              <div className="bg-white p-4 rounded-lg shadow-sm border">
                <div className="flex items-center gap-2 text-yellow-600">
                  <Star className="h-5 w-5" />
                  <span className="text-sm font-medium">Avg Rating</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{averageRating.toFixed(1)}</p>
              </div>
              
              <div className="bg-white p-4 rounded-lg shadow-sm border">
                <div className="flex items-center gap-2 text-purple-600">
                  <Clock className="h-5 w-5" />
                  <span className="text-sm font-medium">Updated</span>
                </div>
                <p className="text-sm text-gray-600">Just now</p>
              </div>
            </div>
          )}

          {/* Visualizations */}
          {chartData && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Rating Chart */}
              {chartData.ratings.length > 0 && (
                <div className="bg-white p-4 rounded-lg shadow-sm border">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Rating Distribution</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={chartData.ratings}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="name" 
                        tick={{ fontSize: 12 }}
                        angle={-45}
                        textAnchor="end"
                        height={80}
                      />
                      <YAxis domain={[0, 5]} />
                      <Tooltip 
                        formatter={(value: number) => [`${value.toFixed(1)}/5`, 'Rating']}
                        labelFormatter={(label) => `Place: ${label}`}
                      />
                      <Bar 
                        dataKey="rating" 
                        fill="#3b82f6"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Category Pie Chart */}
              {pieData.length > 0 && (
                <div className="bg-white p-4 rounded-lg shadow-sm border">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Content Types</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="text-xs text-gray-500 bg-gray-100 px-3 py-2 rounded">
            <div className="flex items-center justify-between">
              <span>AI-generated summary</span>
              <span>Updated {new Date().toLocaleTimeString()}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnhancedAISummary;
