from setuptools import setup

setup(
    name="comfy-auto",
    version="0.1.0",
    py_modules=["app", "client", "config", "pipeline", "prompts"],
    entry_points={
        "console_scripts": [
            "comfy-auto=app:main",
        ],
    },
    install_requires=[
        "requests",
        "websocket-client",
    ],
)