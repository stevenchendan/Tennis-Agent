import type { Metadata } from 'next';
import ArenaExperience from '@/components/arena1573/ArenaExperience';

export const metadata: Metadata = {
  title: '1573 Arena · Court Atlas',
  description: 'An interactive architectural study of 1573 Arena and its Melbourne Park surroundings.',
};

export default function ArenaPage() {
  return <ArenaExperience />;
}
