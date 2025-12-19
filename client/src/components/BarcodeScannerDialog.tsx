import { useState, useEffect, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, Camera, AlertCircle, SwitchCamera } from "lucide-react";

interface CameraDevice {
  id: string;
  label: string;
}

interface BarcodeScannerDialogProps {
  open: boolean;
  onClose: () => void;
  onBarcodeDetected: (barcode: string) => void;
}

export default function BarcodeScannerDialog({
  open,
  onClose,
  onBarcodeDetected,
}: BarcodeScannerDialogProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0);
  const scannerRef = useRef<any>(null);
  const videoRef = useRef<HTMLDivElement>(null);
  const isStartingRef = useRef(false);

  const cleanup = useCallback(async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        if (state === 2) { // SCANNING state
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch (err) {
        console.error("Scanner cleanup error:", err);
      }
      scannerRef.current = null;
    }
    isStartingRef.current = false;
    setIsScanning(false);
    setIsStarting(false);
  }, []);

  const findBackCamera = useCallback((cameraList: CameraDevice[]): number => {
    const backCameraIndex = cameraList.findIndex((cam) => {
      const label = cam.label.toLowerCase();
      return label.includes("back") || label.includes("rear") || label.includes("environment");
    });
    return backCameraIndex >= 0 ? backCameraIndex : 0;
  }, []);

  const startScanner = useCallback(async (cameraId?: string) => {
    if (isStartingRef.current || !videoRef.current) return;
    
    isStartingRef.current = true;
    setIsStarting(true);
    setError(null);

    try {
      const { Html5Qrcode } = await import("html5-qrcode");

      if (scannerRef.current) {
        try {
          const state = scannerRef.current.getState();
          if (state === 2) {
            await scannerRef.current.stop();
          }
        } catch (err) {
          // Ignore stop errors
        }
      }

      scannerRef.current = new Html5Qrcode("barcode-reader");

      const config = {
        fps: 10,
        qrbox: { width: 250, height: 150 },
        aspectRatio: 1.777778,
        formatsToSupport: [
          0, // QR_CODE
          13, // EAN_13
          8, // EAN_8
          12, // UPC_A
          5, // UPC_E
          1, // CODE_128
          2, // CODE_39
        ],
      };

      const onSuccess = (decodedText: string) => {
        console.log("Barcode detected:", decodedText);
        cleanup();
        onBarcodeDetected(decodedText);
      };

      const onError = () => {
        // Ignore scanning errors (they happen constantly while searching)
      };

      if (cameraId) {
        await scannerRef.current.start(cameraId, config, onSuccess, onError);
      } else {
        await scannerRef.current.start(
          { facingMode: "environment" },
          config,
          onSuccess,
          onError
        );
      }

      setIsScanning(true);
    } catch (err: any) {
      console.error("Scanner initialization error:", err);
      
      if (err.name === "NotAllowedError") {
        setError("Camera permission denied. Please enable camera access and try again.");
      } else if (err.name === "NotFoundError") {
        setError("No camera found on this device.");
      } else if (err.message?.includes("environment")) {
        setError("Back camera not available. Try switching cameras.");
      } else {
        setError("Failed to start camera. Please try again.");
      }
    } finally {
      isStartingRef.current = false;
      setIsStarting(false);
    }
  }, [cleanup, onBarcodeDetected]);

  const switchCamera = useCallback(async () => {
    if (cameras.length <= 1) return;
    
    const nextIndex = (currentCameraIndex + 1) % cameras.length;
    setCurrentCameraIndex(nextIndex);
    await startScanner(cameras[nextIndex].id);
  }, [cameras, currentCameraIndex, startScanner]);

  useEffect(() => {
    if (!open) {
      cleanup();
      return;
    }

    let mounted = true;

    const initScanner = async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");

        if (!mounted || !videoRef.current) return;

        try {
          const devices = await Html5Qrcode.getCameras();
          if (mounted && devices.length > 0) {
            const cameraList = devices.map((d) => ({ id: d.id, label: d.label }));
            setCameras(cameraList);
            
            const backIndex = findBackCamera(cameraList);
            setCurrentCameraIndex(backIndex);
            
            await startScanner(cameraList[backIndex].id);
          } else if (mounted) {
            await startScanner();
          }
        } catch (enumError) {
          console.log("Camera enumeration failed, using facingMode fallback");
          if (mounted) {
            await startScanner();
          }
        }
      } catch (err: any) {
        console.error("Scanner initialization error:", err);
        if (mounted) {
          setError("Failed to initialize scanner. Please try again.");
        }
      }
    };

    initScanner();

    return () => {
      mounted = false;
      cleanup();
    };
  }, [open, cleanup, findBackCamera, startScanner]);

  const handleClose = () => {
    cleanup();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-barcode-scanner">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="w-5 h-5" />
            Scan Barcode
          </DialogTitle>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-4"
            onClick={handleClose}
            data-testid="button-close-scanner"
          >
            <X className="w-4 h-4" />
          </Button>
        </DialogHeader>

        <div className="space-y-4">
          {error ? (
            <div className="flex flex-col items-center justify-center p-8 space-y-4">
              <AlertCircle className="w-12 h-12 text-destructive" />
              <p className="text-sm text-center text-muted-foreground">{error}</p>
              <div className="flex gap-2">
                {cameras.length > 1 && (
                  <Button 
                    variant="outline" 
                    onClick={switchCamera}
                    data-testid="button-switch-camera-error"
                  >
                    <SwitchCamera className="w-4 h-4 mr-2" />
                    Try Other Camera
                  </Button>
                )}
                <Button onClick={handleClose} data-testid="button-close-error">
                  Close
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div
                id="barcode-reader"
                ref={videoRef}
                className="w-full rounded-lg overflow-hidden bg-muted min-h-[200px]"
                data-testid="video-barcode-scanner"
              />
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Position the barcode within the frame
                </p>
                {cameras.length > 1 && isScanning && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={switchCamera}
                    disabled={isStarting}
                    data-testid="button-switch-camera"
                  >
                    <SwitchCamera className="w-4 h-4 mr-1" />
                    Switch
                  </Button>
                )}
              </div>
              {isStarting && (
                <p className="text-sm text-center text-muted-foreground">
                  Starting camera...
                </p>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
