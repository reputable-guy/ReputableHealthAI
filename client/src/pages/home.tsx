import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { BeakerIcon } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-3xl mx-auto text-center">
          <BeakerIcon className="w-16 h-16 mx-auto text-primary mb-6" />
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl mb-4">
            Reputable Health AI Study Designer
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Design rigorous clinical studies for wellness products with our AI-powered protocol generator
          </p>
          <Link href="/design">
            <Button size="lg" className="rounded-full">
              Start Designing Your Study
            </Button>
          </Link>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mt-16">
          <Card>
            <CardHeader>
              <CardTitle>Study Design</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Automated protocol creation based on your product and research goals
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Data Collection</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Leverage wearable devices for passive data collection and validated questionnaires
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Scientific Rigor</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Generate defensible results and insights through comprehensive protocols
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
