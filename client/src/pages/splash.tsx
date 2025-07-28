import akGenclikGif from "@assets/akgenclik_1753719296848.gif";

export default function SplashScreen() {
  return (
    <div className="fixed inset-0 bg-white z-50 flex items-center justify-center">
      <div className="text-center">
        <img 
          src={akGenclikGif} 
          alt="AK Parti Gençlik Kolları"
          className="mx-auto"
        />
      </div>
    </div>
  );
}
