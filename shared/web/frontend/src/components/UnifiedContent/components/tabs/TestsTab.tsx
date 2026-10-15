/**
 * Tests Tab Component
 *
 * System tests for content management
 */

import * as React from 'react';
import {
	ArrowPathIcon,
	CheckCircleIcon,
	CommandLineIcon,
	PlayIcon,
	XCircleIcon,
	XMarkIcon,
} from '@heroicons/react/24/outline';
import { motion } from 'framer-motion';
import { ButtonV2 } from '../../../ui/ButtonV2';

interface Test {
	id: string;
	name: string;
	description: string;
}

interface TestResult {
	status: 'passed' | 'failed';
	output?: string;
	error?: string;
}

interface TestsTabProps {
	availableTests: Test[];
	runningTest: string | null;
	testResults: Record<string, TestResult>;
	testOutput: string;
	onRunTest: (testId: string) => void;
	onClearOutput: () => void;
}

export const TestsTab: React.FC<TestsTabProps> = ({
	availableTests,
	runningTest,
	testResults,
	testOutput,
	onRunTest,
	onClearOutput,
}) => {
	return (
		<div className="space-y-6">
			<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
				{availableTests.map((test) => {
					const result = testResults[test.id];
					const isRunning = runningTest === test.id;

					return (
						<motion.div
							key={test.id}
							className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl p-6 shadow-xl shadow-purple-500/20"
							transition={{ duration: 0.2 }}
						>
							<div className="flex items-start justify-between mb-3">
								<div>
									<h3 className="text-white font-semibold mb-1">{test.name}</h3>
									<p className="text-gray-400 text-sm">{test.description}</p>
								</div>
								{result &&
									(result.status === 'passed' ? (
										<CheckCircleIcon className="w-6 h-6 text-green-400 shrink-0" />
									) : (
										<XCircleIcon className="w-6 h-6 text-red-400 shrink-0" />
									))}
							</div>

							<ButtonV2
								variant={isRunning ? 'ghost' : 'secondary'}
								size="md"
								onClick={() => onRunTest(test.id)}
								disabled={isRunning}
								iconLeft={
									isRunning ? (
										<ArrowPathIcon className="w-4 h-4 animate-spin" />
									) : (
										<PlayIcon className="w-4 h-4" />
									)
								}
								className="w-full"
							>
								{isRunning ? 'Выполняется...' : 'Запустить тест'}
							</ButtonV2>
						</motion.div>
					);
				})}
			</div>

			{/* Test Output */}
			{testOutput && (
				<motion.div
					className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl p-6 shadow-xl shadow-purple-500/20"
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.3 }}
				>
					<div className="flex items-center justify-between mb-3">
						<div className="flex items-center gap-2">
							<CommandLineIcon className="w-5 h-5 text-green-400" />
							<h3 className="text-white font-semibold">Результат теста</h3>
						</div>
						<ButtonV2
							variant="ghost"
							size="icon"
							onClick={onClearOutput}
							iconLeft={<XMarkIcon className="w-4 h-4" />}
						/>
					</div>
					<pre className="bg-black/60 rounded-lg p-4 text-sm text-green-400 font-mono overflow-x-auto max-h-96">
						{testOutput}
					</pre>
				</motion.div>
			)}
		</div>
	);
};
