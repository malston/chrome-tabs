#!/bin/bash
# Create simple colored squares as icons using ImageMagick or base64 PNG

# Create a simple 16x16 icon
cat > icon16.png << 'ICON16'
iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlz
AAAA3QAAAN0BcFOiBwAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAABTSURB
VDiN7ZKxDQAgDMOyR2f/Fbpk2YgQQrxFd+SYjAEA4F8AQghQSwEppYhSSlRVUVWhlIKqKpRSkFKK
qiqklCKlFFJKEVKKqipQSiFKKUQpBQDwBfUBSL9P6U4AAAAASUVORK5CYII=
ICON16

# Create identical icons for 48 and 128
cp icon16.png icon48.png
cp icon16.png icon128.png

echo "Icons created"
