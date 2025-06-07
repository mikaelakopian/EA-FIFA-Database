import React from "react";
import { Card, Progress, Chip, Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useProgress } from "../context/ProgressContext";

interface LoadingProgressCardProps {
  functionName: string;
  onCancel?: () => void;
  className?: string;
  compact?: boolean;
}

export default function LoadingProgressCard({ 
  functionName, 
  onCancel, 
  className = "",
  compact = false 
}: LoadingProgressCardProps) {
  const { progresses } = useProgress();
  
  // Find progress for this function
  const progress = progresses.find(p => 
    p.function_name === functionName && 
    (p.status === 'processing' || p.status === 'starting')
  );

  if (!progress) {
    return null;
  }

  const percentage = progress.percentage || 0;
  const isCompleting = percentage >= 99;
  
  if (compact) {
    return (
      <div className={`fixed top-0 left-0 right-0 z-50 bg-warning-50/95 backdrop-blur-sm border-b border-warning-200 px-4 py-1.5 ${className}`}>
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1">
              <Icon 
                icon={isCompleting ? "lucide:check-circle" : "lucide:loader-2"} 
                className={`h-3.5 w-3.5 text-warning-600 ${!isCompleting ? 'animate-spin' : ''}`}
              />
              <div className="flex items-center gap-2 flex-1">
                <span className="text-xs font-medium text-default-800">Loading Players</span>
                <Chip color={isCompleting ? "success" : "warning"} variant="flat" size="sm">
                  {percentage.toFixed(1)}%
                </Chip>
                {progress.current !== undefined && progress.total !== undefined && (
                  <span className="text-xs text-default-600">
                    {progress.current.toLocaleString()} / {progress.total.toLocaleString()}
                  </span>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-3 min-w-0">
              {progress.message && (
                <span className="text-xs text-default-600 truncate max-w-40">
                  {progress.message}
                </span>
              )}
              
              {progress.estimated_time_remaining && (
                <div className="text-xs text-default-500">
                  {progress.estimated_time_remaining}
                </div>
              )}
              
              {onCancel && !isCompleting && (
                <Button
                  isIconOnly
                  size="sm"
                  variant="light"
                  color="danger"
                  onPress={onCancel}
                  className="h-6 w-6 min-w-6"
                >
                  <Icon icon="lucide:x" className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
          
          <div className="mt-1.5">
            <Progress
              value={percentage}
              color="warning"
              className="w-full"
              size="sm"
              aria-label="Loading progress"
            />
          </div>
        </div>
      </div>
    );
  }

  // Original card layout for non-compact mode
  return (
    <Card className={`p-4 bg-default-50 border-warning-200 border-2 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon 
            icon={isCompleting ? "lucide:check-circle" : "lucide:loader-2"} 
            className={`h-5 w-5 text-warning-600 ${!isCompleting ? 'animate-spin' : ''}`}
          />
          <h4 className="text-lg font-semibold text-default-800">
            Loading Players
          </h4>
          <Chip 
            color={isCompleting ? "success" : "warning"} 
            variant="flat" 
            size="sm"
          >
            {progress.status === 'starting' ? 'Starting...' : 
             isCompleting ? 'Completing...' : 
             'Loading...'}
          </Chip>
        </div>
        
        {onCancel && !isCompleting && (
          <Button
            isIconOnly
            size="sm"
            variant="light"
            color="danger"
            onPress={onCancel}
          >
            <Icon icon="lucide:x" className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="space-y-3">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-sm">
            <span className="text-default-600">Progress</span>
            <span className="font-medium text-warning-600">
              {percentage.toFixed(1)}%
            </span>
          </div>
          <Progress
            value={percentage}
            color="warning"
            className="w-full"
            size="md"
            aria-label="Loading progress"
          />
        </div>

        {/* Current/Total Count */}
        {progress.current !== undefined && progress.total !== undefined && (
          <div className="flex justify-between items-center text-sm">
            <span className="text-default-600">Players</span>
            <span className="font-medium">
              {progress.current.toLocaleString()} / {progress.total.toLocaleString()}
            </span>
          </div>
        )}

        {/* Message */}
        {progress.message && (
          <div className="text-sm text-default-700 bg-default-100 p-2 rounded-lg">
            {progress.message}
          </div>
        )}

        {/* Batch Info */}
        {progress.batch_size && (
          <div className="flex justify-between items-center text-xs text-default-500">
            <span>Batch Size: {progress.batch_size}</span>
            {progress.batch_start !== undefined && progress.batch_end !== undefined && (
              <span>
                Current Batch: {progress.batch_start + 1}-{progress.batch_end}
              </span>
            )}
          </div>
        )}

        {/* Time Estimates */}
        <div className="grid grid-cols-2 gap-4 text-xs">
          {progress.elapsed_time && (
            <div className="flex flex-col">
              <span className="text-default-500">Elapsed</span>
              <span className="font-medium text-default-700">
                {progress.elapsed_time}
              </span>
            </div>
          )}
          
          {progress.estimated_time_remaining && (
            <div className="flex flex-col">
              <span className="text-default-500">Remaining</span>
              <span className="font-medium text-default-700">
                {progress.estimated_time_remaining}
              </span>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
} 