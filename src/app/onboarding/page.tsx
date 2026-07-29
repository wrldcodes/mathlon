'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { NameScreen } from '../components/NameScreen';
import { LevelSelectScreen, type Level } from '../components/LevelSelectScreen';
import { TopicsScreen } from '../components/TopicsScreen';
import { GoalScreen } from '../components/GoalScreen';
import { LearningStyleScreen } from '../components/LearningStyleScreen';
import { ReadyScreen } from '../components/ReadyScreen';

const TOTAL_STEPS = 6;

type OnboardingData = {
  name: string;
  level: Level | null;
  topics: string[];
  goal: string;
  learningStyle: string;
};

export default function OnboardingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [data, setData] = useState<OnboardingData>({
    name: '',
    level: null,
    topics: [],
    goal: '',
    learningStyle: '',
  });

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    } else {
      router.push('/');
    }
  };

  const handleNameComplete = (name: string) => {
    setData((prev) => ({ ...prev, name }));
    setCurrentStep(2);
  };

  const handleLevelComplete = (level: Level) => {
    setData((prev) => ({ ...prev, level }));
    setCurrentStep(3);
  };

  const handleTopicsComplete = (topics: string[]) => {
    setData((prev) => ({ ...prev, topics }));
    setCurrentStep(4);
  };

  const handleGoalComplete = (goal: string) => {
    setData((prev) => ({ ...prev, goal }));
    setCurrentStep(5);
  };

  const handleLearningStyleComplete = (style: string) => {
    setData((prev) => ({ ...prev, learningStyle: style }));
    setCurrentStep(6);
  };

  const handleStartLearning = () => {
    localStorage.setItem('mathlon-onboarding', JSON.stringify(data));
    router.push('/');
  };

  switch (currentStep) {
    case 1:
      return (
        <NameScreen
          currentStep={currentStep}
          totalSteps={TOTAL_STEPS}
          onContinue={handleNameComplete}
          onBack={handleBack}
        />
      );
    case 2:
      return (
        <LevelSelectScreen
          currentStep={currentStep}
          totalSteps={TOTAL_STEPS}
          onContinue={handleLevelComplete}
          onBack={handleBack}
        />
      );
    case 3:
      return (
        <TopicsScreen
          currentStep={currentStep}
          totalSteps={TOTAL_STEPS}
          onContinue={handleTopicsComplete}
          onBack={handleBack}
        />
      );
    case 4:
      return (
        <GoalScreen
          currentStep={currentStep}
          totalSteps={TOTAL_STEPS}
          onContinue={handleGoalComplete}
          onBack={handleBack}
        />
      );
    case 5:
      return (
        <LearningStyleScreen
          currentStep={currentStep}
          totalSteps={TOTAL_STEPS}
          onContinue={handleLearningStyleComplete}
          onBack={handleBack}
        />
      );
    case 6:
      return (
        <ReadyScreen
          currentStep={currentStep}
          totalSteps={TOTAL_STEPS}
          name={data.name}
          onStartLearning={handleStartLearning}
          onBack={handleBack}
        />
      );
    default:
      return null;
  }
}
